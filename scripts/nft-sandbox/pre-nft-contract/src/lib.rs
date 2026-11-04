// Reconstructed pre-NFT claims schema and financial implementation; LOCAL REHEARSAL ONLY.
use near_sdk::{
    env,
    near,
    AccountId,
    PanicOnDefault,
    Gas, NearToken, Promise, PromiseError,
    json_types::U128,
};
use std::collections::BTreeMap;

const TOTAL_ALLOCATION: u16 = 10_000;
const MIGRATION_COMPLETED_KEY: &[u8] = b"ZINC_DEPOSIT_SCHEMA_MIGRATED";
const CLAIMS_MIGRATION_KEY: &[u8] = b"ZINC_CLAIMS_SCHEMA_MIGRATED";

// Exact deployed deposit-era state; Campaign already includes deposited totals.
#[derive(near_sdk::borsh::BorshDeserialize, near_sdk::borsh::BorshSerialize)]
#[borsh(crate = "near_sdk::borsh")]
struct DepositZincContract {
    campaigns: Vec<Campaign>,
}

#[derive(near_sdk::borsh::BorshDeserialize, near_sdk::borsh::BorshSerialize, Default, Clone, Copy)]
#[borsh(crate = "near_sdk::borsh")]
struct ClaimBalance {
    // Includes the pending reservation until its transfer callback resolves.
    claimed: u128,
    pending: u128,
}

// Exact pre-deposit Borsh layouts. Never reorder or add fields here.
#[derive(near_sdk::borsh::BorshDeserialize, near_sdk::borsh::BorshSerialize, Clone)]
#[borsh(crate = "near_sdk::borsh")]
struct OldCampaign {
    id: u64,
    creator: AccountId,
    name: String,
    description: String,
    start_timestamp_ms: u64,
    end_timestamp_ms: u64,
    contributors: Vec<Contributor>,
    treasury_account: AccountId,
    treasury_share_bps: u16,
    created_at_ms: u64,
}

#[derive(near_sdk::borsh::BorshDeserialize, near_sdk::borsh::BorshSerialize)]
#[borsh(crate = "near_sdk::borsh")]
struct OldZincContract {
    campaigns: Vec<OldCampaign>,
}

// Keep yoctoNEAR exact in JSON while storing a native u128 in Borsh.
mod yocto_decimal {
    use near_sdk::{json_types::U128, serde::{Deserialize, Deserializer, Serialize, Serializer}};

    pub fn serialize<S: Serializer>(value: &u128, serializer: S) -> Result<S::Ok, S::Error> {
        U128(*value).serialize(serializer)
    }

    pub fn deserialize<'de, D: Deserializer<'de>>(deserializer: D) -> Result<u128, D::Error> {
        U128::deserialize(deserializer).map(|value| value.0)
    }
}

#[near(serializers = [json, borsh])]
#[derive(Clone)]
pub struct Contributor {
    pub role: String,
    pub account_id: AccountId,

    // Basis points:
    // 2500 = 25%
    pub share_bps: u16,
}

#[near(serializers = [json, borsh])]
#[derive(Clone)]
pub struct Campaign {
    pub id: u64,
    pub creator: AccountId,

    pub name: String,
    pub description: String,

    pub start_timestamp_ms: u64,
    pub end_timestamp_ms: u64,

    pub contributors: Vec<Contributor>,

    pub treasury_account: AccountId,
    pub treasury_share_bps: u16,

    pub created_at_ms: u64,
    #[serde(with = "yocto_decimal")]
    pub total_deposited_yocto: u128,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct ZincContract {
    campaigns: Vec<Campaign>,
    claims: BTreeMap<(u64, AccountId), ClaimBalance>,
}

#[near]
impl ZincContract {
    #[init(ignore_state)]
    #[private]
    pub fn migrate_claims() -> Self {
        assert_eq!(env::predecessor_account_id(), env::current_account_id(),
            "Migration can only be called by the contract itself");
        assert!(!env::storage_has_key(CLAIMS_MIGRATION_KEY),
            "Claims schema migration already completed");
        let bytes = env::storage_read(b"STATE")
            .expect("Claims migration failed: existing contract state is missing");
        let old: DepositZincContract = near_sdk::borsh::from_slice(&bytes)
            .expect("Claims migration failed: state does not match the deployed deposit schema");
        env::storage_write(CLAIMS_MIGRATION_KEY, &[1]);
        Self { campaigns: old.campaigns, claims: BTreeMap::new() }
    }

    #[init(ignore_state)]
    #[private]
    pub fn migrate() -> Self {
        // Also enforce this in the Rust body, so direct calls cannot bypass it.
        assert_eq!(env::predecessor_account_id(), env::current_account_id(),
            "Migration can only be called by the contract itself");
        assert!(!env::storage_has_key(MIGRATION_COMPLETED_KEY),
            "Campaign deposit schema migration already completed");

        // Decode raw STATE explicitly to give a useful error for wrong schemas.
        let bytes = env::storage_read(b"STATE")
            .expect("Migration failed: existing contract state is missing");
        let old: OldZincContract = near_sdk::borsh::from_slice(&bytes)
            .expect("Migration failed: state does not match the old campaign schema");
        let campaigns = old.campaigns.into_iter().map(|campaign| Campaign {
            id: campaign.id,
            creator: campaign.creator,
            name: campaign.name,
            description: campaign.description,
            start_timestamp_ms: campaign.start_timestamp_ms,
            end_timestamp_ms: campaign.end_timestamp_ms,
            contributors: campaign.contributors,
            treasury_account: campaign.treasury_account,
            treasury_share_bps: campaign.treasury_share_bps,
            created_at_ms: campaign.created_at_ms,
            total_deposited_yocto: 0,
        }).collect();

        // The generated initializer persists Self in this same atomic receipt.
        env::storage_write(MIGRATION_COMPLETED_KEY, &[1]);
        Self { campaigns, claims: BTreeMap::new() }
    }

    #[init]
    pub fn new() -> Self {
        Self { campaigns: Vec::new(), claims: BTreeMap::new() }
    }

    pub fn create_campaign(
        &mut self,
        name: String,
        description: String,
        start_timestamp_ms: u64,
        end_timestamp_ms: u64,
        contributors: Vec<Contributor>,
        treasury_account: AccountId,
        treasury_share_bps: u16,
    ) -> Campaign {
        // -----------------------------
        // Basic campaign validation
        // -----------------------------

        assert!(
            !name.trim().is_empty(),
            "Campaign name is required"
        );

        assert!(
            !description.trim().is_empty(),
            "Campaign description is required"
        );

        assert!(
            end_timestamp_ms > start_timestamp_ms,
            "Campaign end date must be after start date"
        );

        assert!(
            !contributors.is_empty(),
            "Campaign must have at least one contributor"
        );

        // -----------------------------
        // Contributor validation
        // -----------------------------

        let mut contributor_total: u32 = 0;

        for contributor in &contributors {
            assert!(
                !contributor.role.trim().is_empty(),
                "Contributor role is required"
            );

            assert!(
                contributor.share_bps > 0,
                "Contributor share must be greater than zero"
            );

            contributor_total += contributor.share_bps as u32;
        }

        // -----------------------------
        // Treasury validation
        // -----------------------------

        assert!(
            treasury_share_bps > 0,
            "Treasury share must be greater than zero"
        );

        // -----------------------------
        // Critical Zinc rule:
        // revenue allocation = 100%
        // -----------------------------

        let total_allocation =
            contributor_total + treasury_share_bps as u32;

        assert_eq!(
            total_allocation,
            TOTAL_ALLOCATION as u32,
            "Total revenue allocation must equal 100%"
        );

        // -----------------------------
        // Create campaign
        // -----------------------------

        let campaign_id = self.campaigns.len() as u64;

        let campaign = Campaign {
            id: campaign_id,

            creator: env::predecessor_account_id(),

            name,
            description,

            start_timestamp_ms,
            end_timestamp_ms,

            contributors,

            treasury_account,
            treasury_share_bps,

            created_at_ms: env::block_timestamp_ms(),
            total_deposited_yocto: 0,
        };

        self.campaigns.push(campaign.clone());

        campaign
    }

    #[payable]
    pub fn deposit_revenue(&mut self, campaign_id: u64) -> Campaign {
        let index = usize::try_from(campaign_id).expect("Campaign does not exist");
        let campaign = self.campaigns.get_mut(index).expect("Campaign does not exist");
        let deposit = env::attached_deposit().as_yoctonear();
        assert!(deposit > 0, "Deposit must be greater than zero");

        let now = env::block_timestamp_ms();
        assert!(now >= campaign.start_timestamp_ms, "Campaign has not started");
        assert!(now <= campaign.end_timestamp_ms, "Campaign has ended");

        campaign.total_deposited_yocto = campaign.total_deposited_yocto
            .checked_add(deposit)
            .expect("Total deposited amount overflow");
        campaign.clone()
    }

    pub fn get_claimed(&self, campaign_id: u64, account_id: AccountId) -> U128 {
        self.require_campaign(campaign_id);
        U128(self.claims.get(&(campaign_id, account_id)).copied().unwrap_or_default().claimed)
    }

    pub fn get_claimable(&self, campaign_id: u64, account_id: AccountId) -> U128 {
        let campaign = self.require_campaign(campaign_id);
        let entitlement = Self::entitlement(campaign, &account_id);
        let claimed = self.claims.get(&(campaign_id, account_id)).copied().unwrap_or_default().claimed;
        U128(entitlement.checked_sub(claimed).expect("Claim accounting exceeds entitlement"))
    }

    // Non-payable: a claimant pays gas, but attaches no NEAR.
    pub fn claim_revenue(&mut self, campaign_id: u64) -> Promise {
        let account_id = env::predecessor_account_id();
        let campaign = self.require_campaign(campaign_id);
        assert!(Self::account_share(campaign, &account_id) > 0, "Caller has no revenue share");
        let entitlement = Self::entitlement(campaign, &account_id);
        let key = (campaign_id, account_id.clone());
        let mut balance = self.claims.get(&key).copied().unwrap_or_default();
        assert_eq!(balance.pending, 0, "A claim transfer is already pending");
        let amount = entitlement.checked_sub(balance.claimed)
            .expect("Claim accounting exceeds entitlement");
        assert!(amount > 0, "No revenue available to claim");

        balance.claimed = balance.claimed.checked_add(amount).expect("Claimed amount overflow");
        balance.pending = amount;
        self.claims.insert(key, balance);

        Promise::new(account_id.clone()).transfer(NearToken::from_yoctonear(amount)).then(
            Self::ext(env::current_account_id())
                .with_static_gas(Gas::from_tgas(20))
                .on_claim_transfer(campaign_id, account_id, U128(amount))
        )
    }

    #[private]
    pub fn on_claim_transfer(&mut self, campaign_id: u64, account_id: AccountId, amount: U128) -> bool {
        assert_eq!(env::predecessor_account_id(), env::current_account_id(), "Callback is private");
        assert_eq!(env::promise_results_count(), 1, "Expected one transfer result");
        // Native transfer receipts return empty bytes, not JSON-encoded unit.
        let succeeded = match env::promise_result_checked(0, 0) {
            Ok(_) => true,
            Err(PromiseError::Failed) => false,
            Err(_) => panic!("Unexpected transfer result"),
        };
        let key = (campaign_id, account_id);
        let mut balance = *self.claims.get(&key).expect("No pending claim");
        assert!(amount.0 > 0 && balance.pending == amount.0, "Pending claim amount mismatch");
        if !succeeded {
            balance.claimed = balance.claimed.checked_sub(amount.0).expect("Claim rollback underflow");
        }
        balance.pending = 0;
        self.claims.insert(key, balance);
        succeeded
    }

    // -----------------------------
    // Read methods
    // -----------------------------

    pub fn get_campaign(
        &self,
        campaign_id: u64,
    ) -> Option<Campaign> {
        self.campaigns
            .get(campaign_id as usize)
            .cloned()
    }

    pub fn get_campaign_count(&self) -> u64 {
        self.campaigns.len() as u64
    }

    pub fn get_campaigns(&self) -> Vec<Campaign> {
        self.campaigns.clone()
    }
}

impl ZincContract {
    fn require_campaign(&self, campaign_id: u64) -> &Campaign {
        let index = usize::try_from(campaign_id).expect("Campaign does not exist");
        self.campaigns.get(index).expect("Campaign does not exist")
    }

    fn account_share(campaign: &Campaign, account_id: &AccountId) -> u128 {
        let mut share = if &campaign.treasury_account == account_id {
            u128::from(campaign.treasury_share_bps)
        } else { 0 };
        for contributor in &campaign.contributors {
            if &contributor.account_id == account_id {
                share = share.checked_add(u128::from(contributor.share_bps)).expect("Share overflow");
            }
        }
        assert!(share <= u128::from(TOTAL_ALLOCATION), "Account share exceeds 100%");
        share
    }

    fn entitlement(campaign: &Campaign, account_id: &AccountId) -> u128 {
        let share = Self::account_share(campaign, account_id);
        let total = campaign.total_deposited_yocto;
        let divisor = u128::from(TOTAL_ALLOCATION);
        (total / divisor).checked_mul(share)
            .and_then(|whole| (total % divisor).checked_mul(share)
                .and_then(|remainder| whole.checked_add(remainder / divisor)))
            .expect("Entitlement overflow")
    }

}
