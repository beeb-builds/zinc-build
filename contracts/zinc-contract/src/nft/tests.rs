use super::*;
use near_sdk::{testing_env, test_utils::{VMContextBuilder, get_created_receipts, get_logs}, PromiseResult};

const NEAR: u128 = 1_000_000_000_000_000_000_000_000;
const RIGHT: &str = "campaign:0:right:0";

fn account(value: &str) -> AccountId { value.parse().unwrap() }

fn context(caller: &str, deposit: u128) {
    let mut builder = VMContextBuilder::new();
    builder.current_account_id(account("zinc-builder-2026.testnet"))
        .predecessor_account_id(account(caller)).signer_account_id(account(caller))
        .attached_deposit(NearToken::from_yoctonear(deposit))
        .account_balance(NearToken::from_near(1000))
        .prepaid_gas(Gas::from_tgas(300)).block_timestamp(1500 * 1_000_000);
    testing_env!(builder.build());
}

fn callback(result: PromiseResult) {
    let mut builder = VMContextBuilder::new();
    builder.current_account_id(account("zinc-builder-2026.testnet"))
        .predecessor_account_id(account("zinc-builder-2026.testnet"))
        .account_balance(NearToken::from_near(1000)).prepaid_gas(Gas::from_tgas(300));
    testing_env!(builder.build(), near_sdk::test_vm_config(), near_sdk::RuntimeFeesConfig::test(), Default::default(), vec![result]);
}

fn campaign(id: u64, deposited: u128) -> Campaign {
    Campaign {
        id, creator: account("creator.testnet"), name: format!("Campaign {id}"),
        description: "Original campaign description".into(), start_timestamp_ms: 1000,
        end_timestamp_ms: 2000,
        contributors: vec![
            Contributor { role: "Artist".into(), account_id: account("alice.testnet"), share_bps: 2500 },
            Contributor { role: "Developer".into(), account_id: account("dev.testnet"), share_bps: 2000 },
            Contributor { role: "Promoter".into(), account_id: account("promoter.testnet"), share_bps: 1500 },
        ], treasury_account: account("treasury.testnet"), treasury_share_bps: 4000,
        created_at_ms: 900, total_deposited_yocto: deposited,
    }
}

fn new_contract() -> ZincContract {
    context("creator.testnet", 0);
    let mut contract = ZincContract::new();
    let sample = campaign(0, 0);
    contract.create_campaign(sample.name, sample.description, sample.start_timestamp_ms,
        sample.end_timestamp_ms, sample.contributors, sample.treasury_account, sample.treasury_share_bps);
    contract
}

fn deposit(contract: &mut ZincContract, amount: u128) {
    context("depositor.testnet", amount);
    contract.deposit_revenue(0);
}

fn transfer(contract: &mut ZincContract, from: &str, to: &str) {
    context(from, 1);
    contract.nft_transfer(account(to), RIGHT.into(), None, None);
}

fn claimable(contract: &ZincContract, who: &str) -> u128 {
    contract.get_claimable(0, account(who)).0
}

fn claim(contract: &mut ZincContract, who: &str) -> u128 {
    let amount = claimable(contract, who);
    context(who, 0);
    drop(contract.claim_revenue(0));
    callback(PromiseResult::Successful(vec![]));
    assert!(contract.on_claim_transfer(0, account(who), U128(amount)));
    amount
}

#[test]
fn mints_deterministic_contributor_nfts_with_metadata_and_events() {
    let contract = new_contract();
    assert_eq!(contract.nft_total_supply().0, 3);
    assert_eq!(contract.nft_supply_for_owner(account("treasury.testnet")).0, 0);
    for (index, owner) in ["alice.testnet", "dev.testnet", "promoter.testnet"].iter().enumerate() {
        let token_id = format!("campaign:0:right:{index}");
        let token = contract.nft_token(token_id.clone()).unwrap();
        assert_eq!(token.owner_id, account(owner));
        let metadata = token.metadata.unwrap();
        metadata.assert_valid();
        assert!(metadata.media.is_none());
        assert!(metadata.title.unwrap().contains("Zinc Revenue Right"));
        let extra: serde_json::Value = serde_json::from_str(&metadata.extra.unwrap()).unwrap();
        assert_eq!(extra["contributor_index"], index);
        assert_eq!(contract.get_revenue_right(token_id).unwrap().contributor_index, index as u64);
    }
    contract.nft_metadata().assert_valid();
    assert_eq!(contract.get_campaign_rights(0).len(), 3);
    assert_eq!(contract.nft_tokens(None, Some(2)).len(), 2);
    assert_eq!(contract.nft_tokens_for_owner(account("alice.testnet"), None, None)[0].token_id, RIGHT);
    assert!(contract.nft_token("unknown".into()).is_none());
    let logs = get_logs();
    assert_eq!(logs.iter().filter(|log| log.contains("\"event\":\"nft_mint\"")).count(), 3);
    assert!(logs.iter().all(|log| log.starts_with("EVENT_JSON:") && log.contains("\"standard\":\"nep171\"")));
}

#[test]
fn standard_transfer_changes_ownership_enumeration_and_emits_event() {
    let mut contract = new_contract();
    transfer(&mut contract, "alice.testnet", "bob.testnet");
    assert_eq!(contract.nft_token(RIGHT.into()).unwrap().owner_id, account("bob.testnet"));
    assert_eq!(contract.nft_supply_for_owner(account("alice.testnet")).0, 0);
    assert_eq!(contract.nft_tokens_for_owner(account("bob.testnet"), None, None)[0].token_id, RIGHT);
    assert!(get_logs().iter().any(|log| log.contains("\"event\":\"nft_transfer\"")));
    assert!(get_created_receipts().is_empty());
}

#[test]
#[should_panic(expected = "Only the NFT owner may transfer")]
fn unauthorized_transfer_rejected() {
    let mut contract = new_contract();
    transfer(&mut contract, "stranger.testnet", "bob.testnet");
}

#[test]
#[should_panic(expected = "exactly 1 yoctoNEAR")]
fn zero_transfer_deposit_rejected() {
    let mut contract = new_contract();
    context("alice.testnet", 0);
    contract.nft_transfer(account("bob.testnet"), RIGHT.into(), None, None);
}

#[test]
#[should_panic(expected = "exactly 1 yoctoNEAR")]
fn excess_transfer_deposit_rejected() {
    let mut contract = new_contract();
    context("alice.testnet", 2);
    contract.nft_transfer(account("bob.testnet"), RIGHT.into(), None, None);
}

#[test]
fn current_owner_earns_deposits() {
    let mut contract = new_contract();
    deposit(&mut contract, 10 * NEAR);
    assert_eq!(claimable(&contract, "alice.testnet"), 5 * NEAR / 2);
}

#[test]
fn transfer_before_deposit_gives_future_revenue_to_new_owner() {
    let mut contract = new_contract();
    transfer(&mut contract, "alice.testnet", "bob.testnet");
    deposit(&mut contract, 10 * NEAR);
    assert_eq!(claimable(&contract, "alice.testnet"), 0);
    assert_eq!(claimable(&contract, "bob.testnet"), 5 * NEAR / 2);
}

#[test]
fn transfer_preserves_unclaimed_history_and_only_later_revenue_goes_to_buyer() {
    let mut contract = new_contract();
    deposit(&mut contract, 10 * NEAR);
    transfer(&mut contract, "alice.testnet", "bob.testnet");
    assert_eq!(claimable(&contract, "alice.testnet"), 5 * NEAR / 2);
    assert_eq!(claimable(&contract, "bob.testnet"), 0);
    deposit(&mut contract, 10 * NEAR);
    assert_eq!(claimable(&contract, "alice.testnet"), 5 * NEAR / 2);
    assert_eq!(claimable(&contract, "bob.testnet"), 5 * NEAR / 2);
    assert_eq!(claim(&mut contract, "alice.testnet"), 5 * NEAR / 2);
    assert_eq!(claim(&mut contract, "bob.testnet"), 5 * NEAR / 2);
    assert_eq!(contract.get_claimed(0, account("alice.testnet")).0, 5 * NEAR / 2);
    assert_eq!(contract.get_claimed(0, account("bob.testnet")).0, 5 * NEAR / 2);
    assert_eq!(claimable(&contract, "treasury.testnet"), 8 * NEAR);
}

#[test]
fn multiple_transfers_and_return_to_original_owner_preserve_accounting() {
    let mut contract = new_contract();
    deposit(&mut contract, 4 * NEAR);
    transfer(&mut contract, "alice.testnet", "bob.testnet");
    deposit(&mut contract, 8 * NEAR);
    transfer(&mut contract, "bob.testnet", "carol.testnet");
    deposit(&mut contract, 12 * NEAR);
    transfer(&mut contract, "carol.testnet", "alice.testnet");
    deposit(&mut contract, 4 * NEAR);
    assert_eq!(claimable(&contract, "alice.testnet"), 2 * NEAR);
    assert_eq!(claimable(&contract, "bob.testnet"), 2 * NEAR);
    assert_eq!(claimable(&contract, "carol.testnet"), 3 * NEAR);
    let sum = claim(&mut contract, "alice.testnet") + claim(&mut contract, "bob.testnet") + claim(&mut contract, "carol.testnet");
    assert_eq!(sum, 7 * NEAR);
    for who in ["alice.testnet", "bob.testnet", "carol.testnet"] { assert_eq!(claimable(&contract, who), 0); }
}

#[test]
fn partially_claimed_history_before_transfer_remains_attributed_to_seller() {
    let mut contract = new_contract();
    deposit(&mut contract, 4 * NEAR);
    assert_eq!(claim(&mut contract, "alice.testnet"), NEAR);
    deposit(&mut contract, 6 * NEAR);
    transfer(&mut contract, "alice.testnet", "bob.testnet");
    assert_eq!(contract.get_claimed(0, account("alice.testnet")).0, NEAR);
    assert_eq!(claimable(&contract, "alice.testnet"), 3 * NEAR / 2);
    assert_eq!(claimable(&contract, "bob.testnet"), 0);
    deposit(&mut contract, 4 * NEAR);
    assert_eq!(claim(&mut contract, "bob.testnet"), NEAR);
    assert_eq!(claim(&mut contract, "alice.testnet"), 3 * NEAR / 2);
}

#[test]
#[should_panic(expected = "No revenue available to claim")]
fn former_owner_cannot_overclaim_after_transfer() {
    let mut contract = new_contract();
    deposit(&mut contract, 4 * NEAR);
    transfer(&mut contract, "alice.testnet", "bob.testnet");
    claim(&mut contract, "alice.testnet");
    deposit(&mut contract, 4 * NEAR);
    context("alice.testnet", 0);
    drop(contract.claim_revenue(0));
}

#[test]
fn fractional_yocto_stays_with_its_earner_across_transfers() {
    let mut contract = new_contract();
    deposit(&mut contract, 3); // Alice earned 0.75 yocto.
    transfer(&mut contract, "alice.testnet", "bob.testnet");
    deposit(&mut contract, 1); // Bob earned 0.25 yocto, not Alice's 0.75.
    assert_eq!(claimable(&contract, "alice.testnet"), 0);
    assert_eq!(claimable(&contract, "bob.testnet"), 0);
    transfer(&mut contract, "bob.testnet", "alice.testnet");
    deposit(&mut contract, 1);
    assert_eq!(claimable(&contract, "alice.testnet"), 1);
    transfer(&mut contract, "alice.testnet", "bob.testnet");
    deposit(&mut contract, 3);
    assert_eq!(claimable(&contract, "bob.testnet"), 1);
    assert_eq!(claimable(&contract, "treasury.testnet"), 3);
    let total = ["alice.testnet", "bob.testnet", "dev.testnet", "promoter.testnet", "treasury.testnet"].iter().map(|who| claimable(&contract, who)).sum::<u128>();
    assert!(total <= 8);
}

#[test]
fn transfer_while_claim_pending_keeps_failure_refund_with_original_claimant() {
    let mut contract = new_contract();
    deposit(&mut contract, 4 * NEAR);
    context("alice.testnet", 0);
    drop(contract.claim_revenue(0));
    transfer(&mut contract, "alice.testnet", "bob.testnet");
    deposit(&mut contract, 4 * NEAR);
    callback(PromiseResult::Failed);
    assert!(!contract.on_claim_transfer(0, account("alice.testnet"), U128(NEAR)));
    assert_eq!(claimable(&contract, "alice.testnet"), NEAR);
    assert_eq!(claimable(&contract, "bob.testnet"), NEAR);
}

fn transfer_call(contract: &mut ZincContract) {
    context("alice.testnet", 1);
    drop(contract.nft_transfer_call(account("receiver.testnet"), RIGHT.into(), None, None, "test".into()));
    assert_eq!(get_created_receipts().len(), 2);
}

fn resolve(contract: &mut ZincContract, result: PromiseResult) -> bool {
    callback(result);
    contract.nft_resolve_transfer(account("alice.testnet"), account("receiver.testnet"), RIGHT.into(), None)
}

#[test]
fn transfer_call_acceptance_keeps_receiver_ownership() {
    let mut contract = new_contract();
    deposit(&mut contract, 4 * NEAR);
    transfer_call(&mut contract);
    assert!(resolve(&mut contract, PromiseResult::Successful(b"false".to_vec())));
    deposit(&mut contract, 4 * NEAR);
    assert_eq!(claimable(&contract, "alice.testnet"), NEAR);
    assert_eq!(claimable(&contract, "receiver.testnet"), NEAR);
}

#[test]
fn transfer_call_revert_checkpoints_receiver_period() {
    let mut contract = new_contract();
    deposit(&mut contract, 4 * NEAR);
    transfer_call(&mut contract);
    deposit(&mut contract, 8 * NEAR);
    assert!(!resolve(&mut contract, PromiseResult::Successful(b"true".to_vec())));
    deposit(&mut contract, 4 * NEAR);
    assert_eq!(claimable(&contract, "alice.testnet"), 2 * NEAR);
    assert_eq!(claimable(&contract, "receiver.testnet"), 2 * NEAR);
    assert_eq!(contract.nft_token(RIGHT.into()).unwrap().owner_id, account("alice.testnet"));
}

#[test]
fn failed_receiver_call_reverts_without_stealing_history() {
    let mut contract = new_contract();
    deposit(&mut contract, 4 * NEAR);
    transfer_call(&mut contract);
    assert!(!resolve(&mut contract, PromiseResult::Failed));
    assert_eq!(claimable(&contract, "alice.testnet"), NEAR);
    assert_eq!(claimable(&contract, "receiver.testnet"), 0);
}

#[test]
fn forwarded_nft_is_not_reverted_by_original_receiver_result() {
    let mut contract = new_contract();
    transfer_call(&mut contract);
    deposit(&mut contract, 4 * NEAR);
    transfer(&mut contract, "receiver.testnet", "bob.testnet");
    deposit(&mut contract, 8 * NEAR);
    assert!(resolve(&mut contract, PromiseResult::Successful(b"true".to_vec())));
    assert_eq!(contract.nft_token(RIGHT.into()).unwrap().owner_id, account("bob.testnet"));
    assert_eq!(claimable(&contract, "receiver.testnet"), NEAR);
    assert_eq!(claimable(&contract, "bob.testnet"), 2 * NEAR);
}

#[test]
#[should_panic(expected = "NFT resolver is private")]
fn external_nft_resolver_is_rejected() {
    let mut contract = new_contract();
    context("stranger.testnet", 0);
    contract.nft_resolve_transfer(account("alice.testnet"), account("receiver.testnet"), RIGHT.into(), None);
}

fn write_legacy_state() -> ClaimsZincContract {
    context("zinc-builder-2026.testnet", 0);
    let mut claims = BTreeMap::new();
    claims.insert((0, account("alice.testnet")), ClaimBalance { claimed: NEAR, pending: 0 });
    claims.insert((0, account("treasury.testnet")), ClaimBalance { claimed: NEAR / 2, pending: NEAR / 2 });
    let old = ClaimsZincContract { campaigns: vec![campaign(0, 10 * NEAR), campaign(1, 8 * NEAR + 3)], claims };
    env::state_write(&old);
    // These are real keys left by previous migrations and must survive.
    env::storage_write(MIGRATION_COMPLETED_KEY, &[1]);
    env::storage_write(CLAIMS_MIGRATION_KEY, &[1]);
    old
}

#[test]
fn migration_preserves_every_field_finances_pending_claims_and_mints_rights() {
    let old = write_legacy_state();
    let old_campaigns = near_sdk::borsh::to_vec(&old.campaigns).unwrap();
    let old_claims = near_sdk::borsh::to_vec(&old.claims).unwrap();
    let contract = ZincContract::migrate_nfts();
    assert_eq!(near_sdk::borsh::to_vec(&contract.campaigns).unwrap(), old_campaigns);
    assert_eq!(near_sdk::borsh::to_vec(&contract.claims).unwrap(), old_claims);
    assert_eq!(contract.nft_total_supply().0, 6);
    assert_eq!(contract.nft_token(RIGHT.into()).unwrap().owner_id, account("alice.testnet"));
    assert_eq!(claimable(&contract, "alice.testnet"), 3 * NEAR / 2);
    assert_eq!(claimable(&contract, "treasury.testnet"), 7 * NEAR / 2);
    assert_eq!(env::storage_read(CLAIMS_MIGRATION_KEY), Some(vec![1]));
    assert_eq!(env::storage_read(MIGRATION_COMPLETED_KEY), Some(vec![1]));
    assert!(get_created_receipts().is_empty());
    env::state_write(&contract);
    let stored: ZincContract = env::state_read().unwrap();
    assert_eq!(stored.nft_total_supply().0, 6);
    assert_eq!(near_sdk::borsh::to_vec(&stored.claims).unwrap(), old_claims);
}

#[test]
fn migrated_history_stays_with_seller_and_pending_callback_still_resolves() {
    write_legacy_state();
    let mut contract = ZincContract::migrate_nfts();
    transfer(&mut contract, "alice.testnet", "bob.testnet");
    assert_eq!(claimable(&contract, "alice.testnet"), 3 * NEAR / 2);
    assert_eq!(claimable(&contract, "bob.testnet"), 0);
    callback(PromiseResult::Failed);
    contract.on_claim_transfer(0, account("treasury.testnet"), U128(NEAR / 2));
    assert_eq!(claimable(&contract, "treasury.testnet"), 4 * NEAR);
    deposit(&mut contract, 4 * NEAR);
    assert_eq!(claim(&mut contract, "alice.testnet"), 3 * NEAR / 2);
    assert_eq!(claim(&mut contract, "bob.testnet"), NEAR);
}

#[test]
fn migration_preserves_combined_role_rounding_and_fractional_carry() {
    context("zinc-builder-2026.testnet", 0);
    let mut original = campaign(0, 3);
    original.contributors[1].account_id = account("alice.testnet");
    original.treasury_account = account("alice.testnet"); // 85%, old entitlement floor(2.55)=2.
    env::state_write(&ClaimsZincContract { campaigns: vec![original], claims: BTreeMap::new() });
    let mut contract = ZincContract::migrate_nfts();
    assert_eq!(claimable(&contract, "alice.testnet"), 2);
    transfer(&mut contract, "alice.testnet", "bob.testnet");
    deposit(&mut contract, 1);
    assert_eq!(claimable(&contract, "alice.testnet"), 3); // 2.55 + .60 = 3.15.
    assert_eq!(claimable(&contract, "bob.testnet"), 0);
}

#[test]
#[should_panic(expected = "NFT schema migration already completed")]
fn migration_replay_rejected_even_for_empty_state() {
    context("zinc-builder-2026.testnet", 0);
    env::state_write(&ClaimsZincContract { campaigns: vec![], claims: BTreeMap::new() });
    let contract = ZincContract::migrate_nfts();
    env::state_write(&contract);
    ZincContract::migrate_nfts();
}

#[test]
#[should_panic(expected = "existing state is missing")]
fn missing_migration_state_rejected() {
    context("zinc-builder-2026.testnet", 0);
    env::storage_remove(b"STATE");
    ZincContract::migrate_nfts();
}

#[test]
#[should_panic(expected = "does not match the deployed claims schema")]
fn malformed_migration_state_rejected() {
    context("zinc-builder-2026.testnet", 0);
    env::storage_write(b"STATE", &[255, 0]);
    ZincContract::migrate_nfts();
}

#[test]
#[should_panic(expected = "only be called by the contract itself")]
fn external_migration_rejected() {
    write_legacy_state();
    context("stranger.testnet", 0);
    ZincContract::migrate_nfts();
}

#[test]
#[should_panic(expected = "Insufficient storage reserve")]
fn migration_cannot_spend_beneficiary_revenue_on_nft_storage() {
    write_legacy_state();
    let mut builder = VMContextBuilder::new();
    builder.current_account_id(account("zinc-builder-2026.testnet"))
        .predecessor_account_id(account("zinc-builder-2026.testnet"))
        .account_balance(NearToken::from_yoctonear(17 * NEAR)).prepaid_gas(Gas::from_tgas(300));
    testing_env!(builder.build());
    ZincContract::migrate_nfts();
}

#[test]
fn reports_measured_storage_impact_of_representative_migration() {
    write_legacy_state();
    let before = env::storage_usage();
    let contract = ZincContract::migrate_nfts();
    env::state_write(&contract);
    let additional = env::storage_usage().checked_sub(before).unwrap();
    println!("NFT_MIGRATION_STORAGE: {} bytes for 6 rights; {} yoctoNEAR at current runtime byte cost", additional,
        u128::from(additional) * env::storage_byte_cost().as_yoctonear());
    assert!(additional > 0);
}

#[test]
fn many_deposits_and_transfers_conserve_revenue_with_rounding() {
    let mut contract = new_contract();
    let owners = ["alice.testnet", "bob.testnet", "carol.testnet"];
    let mut total = 0;
    for index in 0..30 {
        let amount = index * 7 + 1;
        deposit(&mut contract, amount);
        total += amount;
        transfer(&mut contract, owners[index as usize % 3], owners[(index as usize + 1) % 3]);
    }
    let mut paid = 0;
    for who in owners.into_iter().chain(["dev.testnet", "promoter.testnet", "treasury.testnet"]) {
        if claimable(&contract, who) > 0 { paid += claim(&mut contract, who); }
    }
    assert!(paid <= total);
    assert!(total - paid < 6); // only each beneficiary's sub-yocto remainder stays held.
}
