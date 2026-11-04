use near_sdk::{
    env,
    near,
    AccountId,
    PanicOnDefault,
    Gas, NearToken, Promise, PromiseError,
    json_types::U128,
};
use std::collections::BTreeMap;
mod nft;
use nft::{AccruedRevenue, RevenueRight};
use near_contract_standards::non_fungible_token::NonFungibleToken;

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
    tokens: NonFungibleToken,
    rights: BTreeMap<String, RevenueRight>,
    accrued: BTreeMap<(u64, AccountId), AccruedRevenue>,
    treasury_checkpoints: BTreeMap<u64, u128>,
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
        Self::from_legacy(old.campaigns, BTreeMap::new())
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
        Self::from_legacy(campaigns, BTreeMap::new())
    }

    #[init]
    pub fn new() -> Self {
        Self::from_legacy(Vec::new(), BTreeMap::new())
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
        self.mint_campaign_rights(&campaign, 0);
        self.assert_storage_reserve();

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
        let entitlement = self.entitlement(campaign, &account_id);
        let claimed = self.claims.get(&(campaign_id, account_id)).copied().unwrap_or_default().claimed;
        U128(entitlement.checked_sub(claimed).expect("Claim accounting exceeds entitlement"))
    }

    // Non-payable: a claimant pays gas, but attaches no NEAR.
    pub fn claim_revenue(&mut self, campaign_id: u64) -> Promise {
        let account_id = env::predecessor_account_id();
        let campaign = self.require_campaign(campaign_id);
        assert!(self.has_revenue_interest(campaign, &account_id), "Caller has no revenue share");
        let entitlement = self.entitlement(campaign, &account_id);
        let key = (campaign_id, account_id.clone());
        let mut balance = self.claims.get(&key).copied().unwrap_or_default();
        assert_eq!(balance.pending, 0, "A claim transfer is already pending");
        let amount = entitlement.checked_sub(balance.claimed)
            .expect("Claim accounting exceeds entitlement");
        assert!(amount > 0, "No revenue available to claim");

        balance.claimed = balance.claimed.checked_add(amount).expect("Claimed amount overflow");
        balance.pending = amount;
        self.claims.insert(key, balance);
        self.assert_storage_reserve();

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

}


#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::{
        test_utils::VMContextBuilder,
        testing_env,
    };

    fn setup_context() {
        let creator: AccountId = "creator.testnet".parse().unwrap();

        let mut builder = VMContextBuilder::new();

        builder
            .signer_account_id(creator.clone())
            .predecessor_account_id(creator);

        testing_env!(builder.build());
    }

    fn valid_contributors() -> Vec<Contributor> {
        vec![
            Contributor {
                role: "Artist".to_string(),
                account_id: "artist.testnet".parse().unwrap(),
                share_bps: 2500,
            },
            Contributor {
                role: "Developer".to_string(),
                account_id: "developer.testnet".parse().unwrap(),
                share_bps: 2000,
            },
            Contributor {
                role: "Promoter".to_string(),
                account_id: "promoter.testnet".parse().unwrap(),
                share_bps: 1500,
            },
        ]
    }

    fn migration_context() {
        let account: AccountId = "zinc-builder-2026.testnet".parse().unwrap();
        let mut builder = VMContextBuilder::new();
        builder.current_account_id(account.clone())
            .signer_account_id(account.clone())
            .predecessor_account_id(account);
        testing_env!(builder.build());
    }

    fn old_campaign(id: u64) -> OldCampaign {
        OldCampaign {
            id,
            creator: format!("creator-{id}.testnet").parse().unwrap(),
            name: format!(" Original campaign {id} "),
            description: format!("Original description {id}\nwith a second line"),
            start_timestamp_ms: 1_762_128_000_000 + id,
            end_timestamp_ms: 1_764_460_800_000 + id,
            contributors: valid_contributors(),
            treasury_account: format!("treasury-{id}.testnet").parse().unwrap(),
            treasury_share_bps: 4000,
            created_at_ms: 1_760_000_000_000 + id,
        }
    }

    fn assert_migrated_fields(old: &OldCampaign, new: &Campaign) {
        assert_eq!(new.id, old.id);
        assert_eq!(new.creator, old.creator);
        assert_eq!(new.name, old.name);
        assert_eq!(new.description, old.description);
        assert_eq!(new.start_timestamp_ms, old.start_timestamp_ms);
        assert_eq!(new.end_timestamp_ms, old.end_timestamp_ms);
        assert_eq!(new.treasury_account, old.treasury_account);
        assert_eq!(new.treasury_share_bps, old.treasury_share_bps);
        assert_eq!(new.created_at_ms, old.created_at_ms);
        assert_eq!(new.contributors.len(), old.contributors.len());
        for (before, after) in old.contributors.iter().zip(&new.contributors) {
            assert_eq!(after.role, before.role);
            assert_eq!(after.account_id, before.account_id);
            assert_eq!(after.share_bps, before.share_bps);
        }
        assert_eq!(new.total_deposited_yocto, 0);
    }

    #[test]
    fn migrates_one_campaign_preserving_every_field() {
        migration_context();
        let old = OldZincContract { campaigns: vec![old_campaign(0)] };
        env::state_write(&old);
        let balance = env::account_balance();
        let migrated = ZincContract::migrate();
        assert_eq!(migrated.get_campaign_count(), 1);
        assert_migrated_fields(&old.campaigns[0], &migrated.get_campaign(0).unwrap());
        // Direct Rust calls omit the generated initializer's final state write.
        env::state_write(&migrated);
        let persisted: ZincContract = env::state_read().unwrap();
        assert_migrated_fields(&old.campaigns[0], &persisted.campaigns[0]);
        assert_eq!(env::account_balance(), balance);
        assert!(near_sdk::test_utils::get_created_receipts().is_empty());
    }

    #[test]
    fn migrates_multiple_campaigns_preserving_order_and_ids() {
        migration_context();
        let old = OldZincContract { campaigns: vec![old_campaign(7), old_campaign(2), old_campaign(19)] };
        env::state_write(&old);
        let migrated = ZincContract::migrate();
        assert_eq!(migrated.get_campaign_count(), 3);
        for (before, after) in old.campaigns.iter().zip(&migrated.campaigns) {
            assert_migrated_fields(before, after);
        }
    }

    #[test]
    fn migrates_empty_old_state() {
        migration_context();
        env::state_write(&OldZincContract { campaigns: vec![] });
        assert_eq!(ZincContract::migrate().get_campaign_count(), 0);
    }

    #[test]
    #[should_panic(expected = "migration already completed")]
    fn rejects_repeat_migration_even_for_empty_state() {
        migration_context();
        env::state_write(&OldZincContract { campaigns: vec![] });
        let migrated = ZincContract::migrate();
        env::state_write(&migrated);
        ZincContract::migrate();
    }

    #[test]
    #[should_panic(expected = "existing contract state is missing")]
    fn rejects_migration_without_old_state() {
        migration_context();
        env::storage_remove(b"STATE");
        ZincContract::migrate();
    }

    #[test]
    #[should_panic(expected = "state does not match the old campaign schema")]
    fn rejects_malformed_migration_state() {
        migration_context();
        env::storage_write(b"STATE", &[255]);
        ZincContract::migrate();
    }

    #[test]
    #[should_panic(expected = "state does not match the old campaign schema")]
    fn rejects_migration_of_new_nonempty_schema() {
        migration_context();
        let current = deposit_campaign();
        migration_context();
        env::state_write(&current);
        ZincContract::migrate();
    }

    #[test]
    #[should_panic(expected = "Migration can only be called by the contract itself")]
    fn rejects_migration_by_external_account() {
        setup_context();
        env::state_write(&OldZincContract { campaigns: vec![old_campaign(0)] });
        ZincContract::migrate();
    }

    #[test]
    fn creates_valid_campaign() {
        setup_context();

        let mut contract = ZincContract::new();

        let campaign = contract.create_campaign(
            "AlphaCats Launch".to_string(),
            "Revenue rights for contributors to the AlphaCats NFT launch."
                .to_string(),
            1_762_128_000_000,
            1_764_460_800_000,
            valid_contributors(),
            "zinc-builder-2026.testnet".parse().unwrap(),
            4000,
        );

        assert_eq!(campaign.id, 0);
        assert_eq!(campaign.name, "AlphaCats Launch");
        assert_eq!(campaign.creator.as_str(), "creator.testnet");
        assert_eq!(campaign.contributors.len(), 3);
        assert_eq!(campaign.treasury_share_bps, 4000);
        assert_eq!(campaign.total_deposited_yocto, 0);

        assert_eq!(contract.get_campaign_count(), 1);

        let stored = contract.get_campaign(0).unwrap();

        assert_eq!(stored.name, "AlphaCats Launch");
        assert_eq!(stored.treasury_account.as_str(), "zinc-builder-2026.testnet");
    }

    fn deposit_context(timestamp_ms: u64, amount: u128) {
        let depositor: AccountId = "depositor.testnet".parse().unwrap();
        let mut builder = VMContextBuilder::new();
        builder.signer_account_id(depositor.clone())
            .predecessor_account_id(depositor)
            .block_timestamp(timestamp_ms * 1_000_000)
            .attached_deposit(near_sdk::NearToken::from_yoctonear(amount));
        testing_env!(builder.build());
    }

    fn deposit_campaign() -> ZincContract {
        setup_context();
        let mut contract = ZincContract::new();
        contract.create_campaign(
            "Deposit campaign".into(), "Deposit test".into(), 1000, 2000,
            valid_contributors(), "treasury.testnet".parse().unwrap(), 4000,
        );
        contract
    }

    #[test]
    fn deposits_to_active_campaign() {
        let mut contract = deposit_campaign();
        let amount = 1_000_000_000_000_000_000_000_000;
        deposit_context(1500, amount);
        let updated = contract.deposit_revenue(0);
        assert_eq!(updated.total_deposited_yocto, amount);
        assert_eq!(contract.get_campaign(0).unwrap().total_deposited_yocto, amount);
        let json = near_sdk::serde_json::to_value(&updated).unwrap();
        assert_eq!(json["total_deposited_yocto"], amount.to_string());
        assert!(near_sdk::test_utils::get_created_receipts().is_empty());
    }

    #[test]
    #[should_panic(expected = "Deposit must be greater than zero")]
    fn rejects_zero_deposit() {
        let mut contract = deposit_campaign();
        deposit_context(1500, 0);
        contract.deposit_revenue(0);
    }

    #[test]
    #[should_panic(expected = "Campaign does not exist")]
    fn rejects_deposit_to_missing_campaign() {
        let mut contract = deposit_campaign();
        deposit_context(1500, 1);
        contract.deposit_revenue(u64::MAX);
    }

    #[test]
    #[should_panic(expected = "Campaign has not started")]
    fn rejects_deposit_before_start() {
        let mut contract = deposit_campaign();
        deposit_context(999, 1);
        contract.deposit_revenue(0);
    }

    #[test]
    #[should_panic(expected = "Campaign has ended")]
    fn rejects_deposit_after_end() {
        let mut contract = deposit_campaign();
        deposit_context(2001, 1);
        contract.deposit_revenue(0);
    }

    #[test]
    fn multiple_deposits_accumulate() {
        let mut contract = deposit_campaign();
        deposit_context(1500, 100);
        contract.deposit_revenue(0);
        deposit_context(1600, 250);
        assert_eq!(contract.deposit_revenue(0).total_deposited_yocto, 350);
        assert_eq!(contract.get_campaign(0).unwrap().total_deposited_yocto, 350);
    }

    #[test]
    fn accepts_deposits_at_start_and_end() {
        let mut contract = deposit_campaign();
        deposit_context(1000, 1);
        contract.deposit_revenue(0);
        deposit_context(2000, 1);
        assert_eq!(contract.deposit_revenue(0).total_deposited_yocto, 2);
    }

    #[test]
    #[should_panic(expected = "Total deposited amount overflow")]
    fn rejects_deposit_overflow() {
        let mut contract = deposit_campaign();
        contract.campaigns[0].total_deposited_yocto = u128::MAX;
        deposit_context(1500, 1);
        contract.deposit_revenue(0);
    }

    #[test]
    #[should_panic(expected = "Total revenue allocation must equal 100%")]
    fn rejects_allocation_above_100_percent() {
        setup_context();

        let mut contract = ZincContract::new();

        let mut contributors = valid_contributors();

        // Artist changes from 25% to 30%.
        // Contributors = 65%, treasury = 40%, total = 105%.
        contributors[0].share_bps = 3000;

        contract.create_campaign(
            "Invalid Campaign".to_string(),
            "This campaign must be rejected.".to_string(),
            1_762_128_000_000,
            1_764_460_800_000,
            contributors,
            "zinc-builder-2026.testnet".parse().unwrap(),
            4000,
        );
    }

    const ONE_NEAR: u128 = 1_000_000_000_000_000_000_000_000;

    fn claim_context(account: &str) {
        let mut builder = VMContextBuilder::new();
        let caller: AccountId = account.parse().unwrap();
        builder.current_account_id("zinc-builder-2026.testnet".parse().unwrap())
            .signer_account_id(caller.clone())
            .predecessor_account_id(caller)
            .account_balance(NearToken::from_near(100))
            .prepaid_gas(Gas::from_tgas(300));
        testing_env!(builder.build());
    }

    fn funded_campaign(amount: u128) -> ZincContract {
        let mut contract = deposit_campaign();
        deposit_context(1500, amount);
        if amount > 0 { contract.deposit_revenue(0); }
        contract
    }

    fn finish_claim(contract: &mut ZincContract, campaign_id: u64, account: &str, amount: u128, success: bool) -> bool {
        let mut builder = VMContextBuilder::new();
        let contract_id: AccountId = "zinc-builder-2026.testnet".parse().unwrap();
        builder.current_account_id(contract_id.clone())
            .predecessor_account_id(contract_id)
            .account_balance(NearToken::from_near(100));
        let result = if success { near_sdk::PromiseResult::Successful(vec![]) }
            else { near_sdk::PromiseResult::Failed };
        testing_env!(builder.build(), near_sdk::test_vm_config(),
            near_sdk::RuntimeFeesConfig::test(), Default::default(), vec![result]);
        contract.on_claim_transfer(campaign_id, account.parse().unwrap(), U128(amount))
    }

    #[test]
    fn contributor_and_treasury_claimable_amounts() {
        let contract = funded_campaign(10 * ONE_NEAR);
        assert_eq!(contract.get_claimable(0, "artist.testnet".parse().unwrap()).0, 5 * ONE_NEAR / 2);
        assert_eq!(contract.get_claimable(0, "treasury.testnet".parse().unwrap()).0, 4 * ONE_NEAR);
        assert_eq!(contract.get_claimed(0, "artist.testnet".parse().unwrap()).0, 0);
    }

    #[test]
    fn contributor_claim_records_accounting_and_exact_transfer() {
        let mut contract = funded_campaign(10 * ONE_NEAR);
        claim_context("artist.testnet");
        drop(contract.claim_revenue(0));
        let amount = 5 * ONE_NEAR / 2;
        let account = "artist.testnet".parse().unwrap();
        assert_eq!(contract.get_claimed(0, account).0, amount);
        assert_eq!(contract.get_claimable(0, "artist.testnet".parse().unwrap()).0, 0);
        let receipts = near_sdk::test_utils::get_created_receipts();
        assert_eq!(receipts.len(), 2);
        assert_eq!(receipts[0].receiver_id.as_str(), "artist.testnet");
        assert!(receipts[0].actions.iter().any(|action| matches!(action,
            near_sdk::mock::MockAction::Transfer { deposit, .. } if deposit.as_yoctonear() == amount)));
        assert_eq!(receipts[1].receiver_id.as_str(), "zinc-builder-2026.testnet");
        assert!(receipts[1].actions.iter().any(|action| matches!(action,
            near_sdk::mock::MockAction::FunctionCallWeight { method_name, .. } if method_name == b"on_claim_transfer")));
        assert!(finish_claim(&mut contract, 0, "artist.testnet", amount, true));
        assert_eq!(contract.get_claimed(0, "artist.testnet".parse().unwrap()).0, amount);
        assert_eq!(contract.claims[&(0, "artist.testnet".parse().unwrap())].pending, 0);
    }

    #[test]
    fn treasury_claim_succeeds() {
        let mut contract = funded_campaign(10 * ONE_NEAR);
        claim_context("treasury.testnet");
        drop(contract.claim_revenue(0));
        assert!(finish_claim(&mut contract, 0, "treasury.testnet", 4 * ONE_NEAR, true));
        assert_eq!(contract.get_claimed(0, "treasury.testnet".parse().unwrap()).0, 4 * ONE_NEAR);
        assert_eq!(contract.get_claimable(0, "treasury.testnet".parse().unwrap()).0, 0);
    }

    #[test]
    #[should_panic(expected = "No revenue available to claim")]
    fn rejects_repeated_completed_claim() {
        let mut contract = funded_campaign(10 * ONE_NEAR);
        claim_context("artist.testnet");
        drop(contract.claim_revenue(0));
        finish_claim(&mut contract, 0, "artist.testnet", 5 * ONE_NEAR / 2, true);
        claim_context("artist.testnet");
        drop(contract.claim_revenue(0));
    }

    #[test]
    #[should_panic(expected = "A claim transfer is already pending")]
    fn rejects_overlapping_claims() {
        let mut contract = funded_campaign(10 * ONE_NEAR);
        claim_context("artist.testnet");
        drop(contract.claim_revenue(0));
        deposit_context(1500, 10 * ONE_NEAR);
        contract.deposit_revenue(0);
        claim_context("artist.testnet");
        drop(contract.claim_revenue(0));
    }

    #[test]
    fn second_deposit_only_unlocks_additional_entitlement() {
        let mut contract = funded_campaign(10 * ONE_NEAR);
        claim_context("artist.testnet");
        drop(contract.claim_revenue(0));
        finish_claim(&mut contract, 0, "artist.testnet", 5 * ONE_NEAR / 2, true);
        deposit_context(1500, 10 * ONE_NEAR);
        contract.deposit_revenue(0);
        assert_eq!(contract.get_claimable(0, "artist.testnet".parse().unwrap()).0, 5 * ONE_NEAR / 2);
        claim_context("artist.testnet");
        drop(contract.claim_revenue(0));
        finish_claim(&mut contract, 0, "artist.testnet", 5 * ONE_NEAR / 2, true);
        assert_eq!(contract.get_claimed(0, "artist.testnet".parse().unwrap()).0, 5 * ONE_NEAR);
        assert_eq!(contract.get_claimable(0, "artist.testnet".parse().unwrap()).0, 0);
    }

    #[test]
    #[should_panic(expected = "Caller has no revenue share")]
    fn rejects_unrelated_claimant() {
        let mut contract = funded_campaign(ONE_NEAR);
        claim_context("stranger.testnet");
        assert_eq!(contract.get_claimable(0, "stranger.testnet".parse().unwrap()).0, 0);
        drop(contract.claim_revenue(0));
    }

    #[test]
    fn multiple_accounts_never_claim_more_than_deposited() {
        let mut contract = funded_campaign(10_003);
        let mut paid = 0_u128;
        for (account, expected) in [("artist.testnet", 2500), ("developer.testnet", 2000),
            ("promoter.testnet", 1500), ("treasury.testnet", 4001)] {
            assert_eq!(contract.get_claimable(0, account.parse().unwrap()).0, expected);
            claim_context(account);
            drop(contract.claim_revenue(0));
            assert!(finish_claim(&mut contract, 0, account, expected, true));
            assert_eq!(contract.get_claimable(0, account.parse().unwrap()).0, 0);
            paid = paid.checked_add(expected).unwrap();
        }
        assert_eq!(paid, 10_001);
        assert!(paid <= contract.get_campaign(0).unwrap().total_deposited_yocto);
    }

    #[test]
    fn zero_deposits_give_zero_claimable() {
        let contract = funded_campaign(0);
        assert_eq!(contract.get_claimable(0, "artist.testnet".parse().unwrap()).0, 0);
        assert_eq!(contract.get_claimable(0, "treasury.testnet".parse().unwrap()).0, 0);
    }

    #[test]
    #[should_panic(expected = "No revenue available to claim")]
    fn rejects_claim_with_no_deposits() {
        let mut contract = funded_campaign(0);
        claim_context("artist.testnet");
        drop(contract.claim_revenue(0));
    }

    #[test]
    fn failed_transfer_restores_claimability_without_losing_later_deposits() {
        let mut contract = funded_campaign(10 * ONE_NEAR);
        claim_context("artist.testnet");
        drop(contract.claim_revenue(0));
        deposit_context(1500, 10 * ONE_NEAR);
        contract.deposit_revenue(0);
        assert!(!finish_claim(&mut contract, 0, "artist.testnet", 5 * ONE_NEAR / 2, false));
        assert_eq!(contract.get_claimed(0, "artist.testnet".parse().unwrap()).0, 0);
        assert_eq!(contract.get_claimable(0, "artist.testnet".parse().unwrap()).0, 5 * ONE_NEAR);
        claim_context("artist.testnet");
        drop(contract.claim_revenue(0));
        assert!(finish_claim(&mut contract, 0, "artist.testnet", 5 * ONE_NEAR, true));
    }

    #[test]
    fn combines_duplicate_contributor_and_treasury_shares() {
        setup_context();
        let mut contract = ZincContract::new();
        let artist: AccountId = "artist.testnet".parse().unwrap();
        let mut contributors = valid_contributors();
        contributors[1].account_id = artist.clone();
        contract.create_campaign("Shared roles".into(), "Combined allocation".into(),
            1000, 2000, contributors, artist.clone(), 4000);
        deposit_context(1500, 10 * ONE_NEAR);
        contract.deposit_revenue(0);
        assert_eq!(contract.get_claimable(0, artist).0, 85 * ONE_NEAR / 10);
        claim_context("artist.testnet");
        drop(contract.claim_revenue(0));
        finish_claim(&mut contract, 0, "artist.testnet", 85 * ONE_NEAR / 10, true);
        assert_eq!(contract.get_claimable(0, "artist.testnet".parse().unwrap()).0, 0);
    }

    #[test]
    fn entitlement_handles_maximum_u128_without_intermediate_overflow() {
        let mut contract = funded_campaign(0);
        contract.campaigns[0].total_deposited_yocto = u128::MAX;
        assert_eq!(contract.get_claimable(0, "artist.testnet".parse().unwrap()).0, u128::MAX / 4);
    }

    #[test]
    #[should_panic(expected = "Campaign does not exist")]
    fn rejects_claim_for_missing_campaign() {
        let mut contract = funded_campaign(ONE_NEAR);
        claim_context("artist.testnet");
        drop(contract.claim_revenue(u64::MAX));
    }

    #[test]
    fn claim_tracking_is_separate_per_campaign_and_persists() {
        let mut contract = funded_campaign(10 * ONE_NEAR);
        let mut second = contract.campaigns[0].clone();
        second.id = 1;
        contract.campaigns.push(second.clone());
        contract.mint_campaign_rights(&second, 0);
        claim_context("artist.testnet");
        drop(contract.claim_revenue(0));
        finish_claim(&mut contract, 0, "artist.testnet", 5 * ONE_NEAR / 2, true);
        env::state_write(&contract);
        let stored: ZincContract = env::state_read().unwrap();
        assert_eq!(stored.get_claimable(0, "artist.testnet".parse().unwrap()).0, 0);
        assert_eq!(stored.get_claimable(1, "artist.testnet".parse().unwrap()).0, 5 * ONE_NEAR / 2);
        assert_eq!(stored.get_claimed(0, "artist.testnet".parse().unwrap()).0, 5 * ONE_NEAR / 2);
    }

    #[test]
    #[should_panic(expected = "Callback is private")]
    fn rejects_external_transfer_callback() {
        let mut contract = funded_campaign(ONE_NEAR);
        claim_context("artist.testnet");
        contract.on_claim_transfer(0, "artist.testnet".parse().unwrap(), U128(1));
    }

    #[test]
    fn claims_migration_preserves_campaigns_deposits_and_prior_marker() {
        let contract = funded_campaign(10 * ONE_NEAR);
        let mut second = contract.campaigns[0].clone();
        second.id = 1;
        second.name = "Second campaign".into();
        second.total_deposited_yocto = 29 * ONE_NEAR + 1;
        let old = DepositZincContract { campaigns: vec![contract.campaigns[0].clone(), second] };
        let expected = near_sdk::borsh::to_vec(&old.campaigns).unwrap();
        migration_context();
        // The fixture targets the deposit-era schema, which had no NFT trie keys.
        // Discard only the mock's synthetic new-schema fixture storage.
        near_sdk::mock::with_mocked_blockchain(|blockchain| { blockchain.take_storage(); });
        env::storage_write(MIGRATION_COMPLETED_KEY, &[1]);
        env::state_write(&old);
        let balance = env::account_balance();
        let migrated = ZincContract::migrate_claims();
        assert!(migrated.claims.is_empty());
        assert_eq!(near_sdk::borsh::to_vec(&migrated.campaigns).unwrap(), expected);
        assert_eq!(env::storage_read(MIGRATION_COMPLETED_KEY), Some(vec![1]));
        assert_eq!(env::account_balance(), balance);
        assert!(near_sdk::test_utils::get_created_receipts().is_empty());
        assert_eq!(migrated.get_claimable(0, "artist.testnet".parse().unwrap()).0, 5 * ONE_NEAR / 2);
        env::state_write(&migrated);
        let stored: ZincContract = env::state_read().unwrap();
        assert_eq!(near_sdk::borsh::to_vec(&stored.campaigns).unwrap(), expected);
        assert!(stored.claims.is_empty());
    }

    #[test]
    #[should_panic(expected = "Claims schema migration already completed")]
    fn rejects_repeated_claims_migration() {
        migration_context();
        env::state_write(&DepositZincContract { campaigns: vec![] });
        let migrated = ZincContract::migrate_claims();
        env::state_write(&migrated);
        ZincContract::migrate_claims();
    }

    #[test]
    #[should_panic(expected = "Migration can only be called by the contract itself")]
    fn rejects_external_claims_migration() {
        setup_context();
        env::state_write(&DepositZincContract { campaigns: vec![] });
        ZincContract::migrate_claims();
    }

    #[test]
    #[should_panic(expected = "state does not match the deployed deposit schema")]
    fn rejects_claims_migration_with_wrong_schema() {
        migration_context();
        env::state_write(&OldZincContract { campaigns: vec![old_campaign(0)] });
        ZincContract::migrate_claims();
    }

    #[test]
    #[should_panic(expected = "existing contract state is missing")]
    fn rejects_claims_migration_without_state() {
        migration_context();
        env::storage_remove(b"STATE");
        ZincContract::migrate_claims();
    }

    #[test]
    #[should_panic(expected = "Total revenue allocation must equal 100%")]
    fn rejects_allocation_below_100_percent() {
        setup_context();

        let mut contract = ZincContract::new();

        contract.create_campaign(
            "Invalid Campaign".to_string(),
            "This campaign must be rejected.".to_string(),
            1_762_128_000_000,
            1_764_460_800_000,
            valid_contributors(),
            "zinc-builder-2026.testnet".parse().unwrap(),

            // Contributors = 60%, treasury = 30%, total = 90%.
            3000,
        );
    }

    #[test]
    #[should_panic(expected = "Campaign end date must be after start date")]
    fn rejects_invalid_dates() {
        setup_context();

        let mut contract = ZincContract::new();

        contract.create_campaign(
            "Bad Dates".to_string(),
            "End date is before start date.".to_string(),

            // Start occurs after end.
            1_764_460_800_000,
            1_762_128_000_000,

            valid_contributors(),
            "zinc-builder-2026.testnet".parse().unwrap(),
            4000,
        );
    }
}
