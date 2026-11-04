use crate::*;
use std::collections::{BTreeSet, HashMap};
use near_contract_standards::non_fungible_token::{
    core::{NonFungibleTokenCore, NonFungibleTokenResolver, ext_nft_receiver},
    enumeration::NonFungibleTokenEnumeration,
    metadata::{NFTContractMetadata, NonFungibleTokenMetadataProvider, TokenMetadata, NFT_METADATA_SPEC},
    events::NftMint,
    Token, TokenId,
};
use near_sdk::{PromiseOrValue, serde_json};

const NFT_MIGRATION_KEY: &[u8] = b"ZINC_NFT_SCHEMA_MIGRATED_V1";

// Exact currently deployed claims-era Borsh state. No NFT fields are present.
#[derive(near_sdk::borsh::BorshDeserialize, near_sdk::borsh::BorshSerialize)]
#[borsh(crate = "near_sdk::borsh")]
struct ClaimsZincContract {
    campaigns: Vec<Campaign>,
    claims: BTreeMap<(u64, AccountId), ClaimBalance>,
}

#[near(serializers = [borsh])]
#[derive(Clone)]
pub(super) struct RevenueRight {
    campaign_id: u64,
    contributor_index: u64,
    role: String,
    share_bps: u16,
    checkpoint_deposited_yocto: u128,
}

#[near(serializers = [json])]
pub struct RevenueRightView {
    pub token_id: TokenId,
    pub owner_id: AccountId,
    pub campaign_id: u64,
    pub contributor_index: u64,
    pub role: String,
    pub share_bps: u16,
}

// A remainder is in 1/10_000 yoctoNEAR. It belongs to an account, never a buyer.
#[near(serializers = [borsh])]
#[derive(Default, Clone, Copy)]
pub(super) struct AccruedRevenue {
    whole: u128,
    remainder: u16,
}

impl AccruedRevenue {
    fn add_share(&mut self, deposited: u128, share_bps: u128) {
        let divisor = u128::from(TOTAL_ALLOCATION);
        assert!(share_bps <= divisor, "Share exceeds 100%");
        let fractional = (deposited % divisor).checked_mul(share_bps)
            .and_then(|value| value.checked_add(u128::from(self.remainder)))
            .expect("Fraction overflow");
        let amount = (deposited / divisor).checked_mul(share_bps)
            .and_then(|value| value.checked_add(fractional / divisor))
            .expect("Entitlement overflow");
        self.whole = self.whole.checked_add(amount).expect("Accrued revenue overflow");
        self.remainder = u16::try_from(fractional % divisor).expect("Invalid fraction");
    }
}

#[near]
impl ZincContract {
    #[init(ignore_state)]
    #[private]
    pub fn migrate_nfts() -> Self {
        assert_eq!(env::predecessor_account_id(), env::current_account_id(), "Migration can only be called by the contract itself");
        assert!(!env::storage_has_key(NFT_MIGRATION_KEY), "NFT schema migration already completed");
        let bytes = env::storage_read(b"STATE").expect("NFT migration failed: existing state is missing");
        let old: ClaimsZincContract = near_sdk::borsh::from_slice(&bytes)
            .expect("NFT migration failed: state does not match the deployed claims schema");
        let contract = Self::from_legacy(old.campaigns, old.claims);
        env::storage_write(NFT_MIGRATION_KEY, &[1]);
        contract.assert_storage_reserve();
        contract
    }

    pub fn get_revenue_right(&self, token_id: TokenId) -> Option<RevenueRightView> {
        let right = self.rights.get(&token_id)?;
        Some(RevenueRightView {
            owner_id: self.tokens.owner_by_id.get(&token_id)?,
            token_id,
            campaign_id: right.campaign_id,
            contributor_index: right.contributor_index,
            role: right.role.clone(),
            share_bps: right.share_bps,
        })
    }

    pub fn get_campaign_rights(&self, campaign_id: u64) -> Vec<RevenueRightView> {
        let campaign = self.require_campaign(campaign_id);
        (0..campaign.contributors.len()).map(|index| {
            self.get_revenue_right(Self::right_token_id(campaign_id, index)).expect("Revenue right is missing")
        }).collect()
    }
}

impl ZincContract {
    pub(super) fn right_token_id(campaign_id: u64, index: usize) -> TokenId {
        format!("campaign:{campaign_id}:right:{index}")
    }

    pub(super) fn from_legacy(campaigns: Vec<Campaign>, claims: BTreeMap<(u64, AccountId), ClaimBalance>) -> Self {
        let mut contract = Self {
            campaigns,
            claims,
            tokens: NonFungibleToken::new(
                b"zinc:nft:v1:owners".to_vec(), env::current_account_id(),
                Some(b"zinc:nft:v1:metadata".to_vec()),
                Some(b"zinc:nft:v1:enumeration".to_vec()),
                None::<Vec<u8>>,
            ),
            rights: BTreeMap::new(),
            accrued: BTreeMap::new(),
            treasury_checkpoints: BTreeMap::new(),
        };
        for campaign in contract.campaigns.clone() {
            let beneficiaries: BTreeSet<AccountId> = campaign.contributors.iter()
                .map(|contributor| contributor.account_id.clone())
                .chain(std::iter::once(campaign.treasury_account.clone())).collect();
            for account in beneficiaries {
                let mut earned = AccruedRevenue::default();
                earned.add_share(campaign.total_deposited_yocto, Self::account_share(&campaign, &account));
                contract.accrued.insert((campaign.id, account), earned);
            }
            contract.mint_campaign_rights(&campaign, campaign.total_deposited_yocto);
        }
        // Existing pending claims are reservations; their original callback stays valid.
        for ((campaign_id, account_id), balance) in &contract.claims {
            assert!(balance.pending <= balance.claimed, "Invalid pending claim state");
            let earned = contract.entitlement(contract.require_campaign(*campaign_id), account_id);
            assert!(balance.claimed <= earned, "Claimed revenue exceeds historical entitlement");
        }
        contract
    }

    pub(super) fn mint_campaign_rights(&mut self, campaign: &Campaign, checkpoint: u128) {
        self.treasury_checkpoints.insert(campaign.id, checkpoint);
        for (index, contributor) in campaign.contributors.iter().enumerate() {
            let token_id = Self::right_token_id(campaign.id, index);
            let metadata = TokenMetadata {
                title: Some(format!("Zinc Revenue Right — Campaign #{} — {}", campaign.id, contributor.role)),
                description: Some("Controls a programmable contributor revenue share. Transfers change future revenue ownership; previously earned revenue remains with its beneficiary.".into()),
                copies: Some(1),
                extra: Some(serde_json::json!({
                    "campaign_id": campaign.id,
                    "campaign_name": campaign.name,
                    "contributor_index": index,
                    "role": contributor.role,
                    "share_bps": contributor.share_bps,
                }).to_string()),
                ..Default::default()
            };
            // Zinc sponsors storage; no public mint entrypoint or fake media URL.
            self.tokens.internal_mint_with_refund(token_id.clone(), contributor.account_id.clone(), Some(metadata), None);
            assert!(self.rights.insert(token_id.clone(), RevenueRight {
                campaign_id: campaign.id,
                contributor_index: u64::try_from(index).expect("Too many contributors"),
                role: contributor.role.clone(),
                share_bps: contributor.share_bps,
                checkpoint_deposited_yocto: checkpoint,
            }).is_none(), "Duplicate revenue right");
            NftMint { owner_id: &contributor.account_id, token_ids: &[&token_id], memo: None }.emit();
        }
    }

    pub(super) fn entitlement(&self, campaign: &Campaign, account_id: &AccountId) -> u128 {
        let mut earned = self.accrued.get(&(campaign.id, account_id.clone())).copied().unwrap_or_default();
        if account_id == &campaign.treasury_account {
            let checkpoint = *self.treasury_checkpoints.get(&campaign.id).expect("Treasury checkpoint missing");
            earned.add_share(campaign.total_deposited_yocto.checked_sub(checkpoint).expect("Treasury checkpoint exceeds deposits"), u128::from(campaign.treasury_share_bps));
        }
        for index in 0..campaign.contributors.len() {
            let token_id = Self::right_token_id(campaign.id, index);
            if self.tokens.owner_by_id.get(&token_id).as_ref() == Some(account_id) {
                let right = self.rights.get(&token_id).expect("Revenue right is missing");
                earned.add_share(campaign.total_deposited_yocto.checked_sub(right.checkpoint_deposited_yocto).expect("Right checkpoint exceeds deposits"), u128::from(right.share_bps));
            }
        }
        earned.whole
    }

    pub(super) fn has_revenue_interest(&self, campaign: &Campaign, account_id: &AccountId) -> bool {
        account_id == &campaign.treasury_account
            || self.accrued.contains_key(&(campaign.id, account_id.clone()))
            || (0..campaign.contributors.len()).any(|index| self.tokens.owner_by_id.get(&Self::right_token_id(campaign.id, index)).as_ref() == Some(account_id))
    }

    fn checkpoint_right(&mut self, token_id: &TokenId) {
        let owner = self.tokens.owner_by_id.get(token_id).expect("Token not found");
        let right = self.rights.get(token_id).expect("Revenue right is missing").clone();
        let total = self.require_campaign(right.campaign_id).total_deposited_yocto;
        let delta = total.checked_sub(right.checkpoint_deposited_yocto).expect("Checkpoint exceeds deposits");
        self.accrued.entry((right.campaign_id, owner)).or_default().add_share(delta, u128::from(right.share_bps));
        self.rights.get_mut(token_id).unwrap().checkpoint_deposited_yocto = total;
    }

    fn validate_transfer(&self, receiver_id: &AccountId, token_id: &TokenId) -> AccountId {
        assert_eq!(env::attached_deposit().as_yoctonear(), 1, "NFT transfer requires exactly 1 yoctoNEAR");
        let owner = self.tokens.owner_by_id.get(token_id).expect("Token not found");
        // Optional NEP-178 approvals are deliberately disabled in this milestone.
        assert_eq!(env::predecessor_account_id(), owner, "Only the NFT owner may transfer");
        assert_ne!(&owner, receiver_id, "Current and next owner must differ");
        owner
    }

    pub(super) fn assert_storage_reserve(&self) {
        // Account for the generated wrapper's future STATE write as well as the
        // standard collections that already wrote their entries during this call.
        let previous_len = env::storage_read(b"STATE").map(|bytes| bytes.len() as u64);
        let state_len = near_sdk::borsh::to_vec(self).expect("Cannot size state").len() as u64;
        let usage = match previous_len {
            Some(previous) => env::storage_usage().checked_sub(previous).and_then(|base| base.checked_add(state_len)),
            None => env::storage_usage().checked_add(state_len).and_then(|base| base.checked_add(45)),
        }.expect("Storage size overflow");
        let storage_cost = u128::from(usage).checked_mul(env::storage_byte_cost().as_yoctonear()).expect("Storage cost overflow");
        let deposited = self.campaigns.iter().try_fold(0_u128, |sum, campaign| sum.checked_add(campaign.total_deposited_yocto)).expect("Deposited totals overflow");
        let paid = self.claims.values().try_fold(0_u128, |sum, balance| {
            balance.claimed.checked_sub(balance.pending).and_then(|settled| sum.checked_add(settled))
        }).expect("Settled claims overflow");
        let liabilities = deposited.checked_sub(paid).expect("Paid claims exceed deposits");
        let required = storage_cost.checked_add(liabilities).expect("Required balance overflow");
        assert!(env::account_balance().as_yoctonear() >= required,
            "Insufficient storage reserve: fund Zinc separately from beneficiary revenue before minting or transferring");
    }
}

#[near]
impl NonFungibleTokenCore for ZincContract {
    #[payable]
    fn nft_transfer(&mut self, receiver_id: AccountId, token_id: TokenId, approval_id: Option<u64>, memo: Option<String>) {
        self.validate_transfer(&receiver_id, &token_id);
        self.checkpoint_right(&token_id);
        self.tokens.nft_transfer(receiver_id, token_id, approval_id, memo);
        self.assert_storage_reserve();
    }

    #[payable]
    fn nft_transfer_call(&mut self, receiver_id: AccountId, token_id: TokenId, approval_id: Option<u64>, memo: Option<String>, msg: String) -> PromiseOrValue<bool> {
        let old_owner = self.validate_transfer(&receiver_id, &token_id);
        assert!(env::prepaid_gas().as_gas() >= Gas::from_tgas(100).as_gas(), "Attach at least 100 Tgas for NFT transfer-call");
        self.checkpoint_right(&token_id);
        self.tokens.nft_transfer(receiver_id.clone(), token_id.clone(), approval_id, memo);
        self.assert_storage_reserve();
        // Official core uses a 5 Tgas resolver. Zinc's checkpoint/state work needs
        // more, so only this promise wiring is expanded; ownership uses the standard.
        ext_nft_receiver::ext(receiver_id.clone()).with_unused_gas_weight(1)
            .nft_on_transfer(env::predecessor_account_id(), old_owner.clone(), token_id.clone(), msg)
            .then(Self::ext(env::current_account_id()).with_static_gas(Gas::from_tgas(40))
                .with_unused_gas_weight(0)
                .nft_resolve_transfer(old_owner, receiver_id, token_id, None)).into()
    }

    fn nft_token(&self, token_id: TokenId) -> Option<Token> { self.tokens.nft_token(token_id) }
}

#[near]
impl NonFungibleTokenResolver for ZincContract {
    #[private]
    fn nft_resolve_transfer(&mut self, previous_owner_id: AccountId, receiver_id: AccountId, token_id: TokenId, approved_account_ids: Option<HashMap<AccountId, u64>>) -> bool {
        assert_eq!(env::predecessor_account_id(), env::current_account_id(), "NFT resolver is private");
        assert_eq!(env::promise_results_count(), 1, "Expected one NFT receiver result");
        let must_revert: bool = env::promise_result_checked(0, 5).ok()
            .and_then(|value| serde_json::from_slice(&value).ok()).unwrap_or(true);
        if must_revert && self.tokens.owner_by_id.get(&token_id).as_ref() == Some(&receiver_id) {
            self.checkpoint_right(&token_id);
        }
        let accepted = self.tokens.nft_resolve_transfer(previous_owner_id, receiver_id, token_id, approved_account_ids);
        self.assert_storage_reserve();
        accepted
    }
}

#[near]
impl NonFungibleTokenEnumeration for ZincContract {
    fn nft_total_supply(&self) -> U128 { self.tokens.nft_total_supply() }
    fn nft_tokens(&self, from_index: Option<U128>, limit: Option<u64>) -> Vec<Token> { self.tokens.nft_tokens(from_index, limit) }
    fn nft_supply_for_owner(&self, account_id: AccountId) -> U128 { self.tokens.nft_supply_for_owner(account_id) }
    fn nft_tokens_for_owner(&self, account_id: AccountId, from_index: Option<U128>, limit: Option<u64>) -> Vec<Token> { self.tokens.nft_tokens_for_owner(account_id, from_index, limit) }
}

#[near]
impl NonFungibleTokenMetadataProvider for ZincContract {
    fn nft_metadata(&self) -> NFTContractMetadata {
        NFTContractMetadata { spec: NFT_METADATA_SPEC.into(), name: "Zinc Revenue Rights".into(), symbol: "ZINC-RIGHT".into(), icon: None, base_uri: None, reference: None, reference_hash: None }
    }
}

#[cfg(test)]
mod tests;
