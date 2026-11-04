import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const here = fileURLToPath(new URL('.', import.meta.url));
let source = readFileSync(new URL('../../contracts/zinc-contract/src/lib.rs', import.meta.url), 'utf8').replace(/\r\n/g, '\n').split('\n#[cfg(test)]')[0];
// Restore the pre-NFT financial code and exact deployed Borsh state layout.
// This fixture never reads a wallet, network config, or testnet credentials.
for (const line of [
  'mod nft;', 'use nft::{AccruedRevenue, RevenueRight};',
  'use near_contract_standards::non_fungible_token::NonFungibleToken;',
  '    tokens: NonFungibleToken,', '    rights: BTreeMap<String, RevenueRight>,',
  '    accrued: BTreeMap<(u64, AccountId), AccruedRevenue>,',
  '    treasury_checkpoints: BTreeMap<u64, u128>,',
  '        self.mint_campaign_rights(&campaign, 0);',
]) {
  assert(source.includes(line), `Expected restoration anchor: ${line}`);
  source = source.replace(`${line}\n`, '');
}
source = source.replaceAll('        self.assert_storage_reserve();\n', '')
  .replaceAll('Self::from_legacy(old.campaigns, BTreeMap::new())', 'Self { campaigns: old.campaigns, claims: BTreeMap::new() }')
  .replaceAll('Self::from_legacy(campaigns, BTreeMap::new())', 'Self { campaigns, claims: BTreeMap::new() }')
  .replaceAll('Self::from_legacy(Vec::new(), BTreeMap::new())', 'Self { campaigns: Vec::new(), claims: BTreeMap::new() }')
  .replaceAll('self.entitlement(campaign, &account_id)', 'Self::entitlement(campaign, &account_id)')
  .replace('self.has_revenue_interest(campaign, &account_id)', 'Self::account_share(campaign, &account_id) > 0');
const entitlement = `
    fn entitlement(campaign: &Campaign, account_id: &AccountId) -> u128 {
        let share = Self::account_share(campaign, account_id);
        let total = campaign.total_deposited_yocto;
        let divisor = u128::from(TOTAL_ALLOCATION);
        (total / divisor).checked_mul(share)
            .and_then(|whole| (total % divisor).checked_mul(share)
                .and_then(|remainder| whole.checked_add(remainder / divisor)))
            .expect("Entitlement overflow")
    }
`;
const end = source.lastIndexOf('\n}');
assert(end > 0);
source = source.slice(0, end) + entitlement + source.slice(end);
assert(!/from_legacy|self\.entitlement|mod nft|assert_storage_reserve|has_revenue_interest/.test(source));
mkdirSync(`${here}/pre-nft-contract/src`, { recursive: true });
writeFileSync(`${here}/pre-nft-contract/src/lib.rs`, '// Reconstructed pre-NFT claims schema and financial implementation; LOCAL REHEARSAL ONLY.\n' + source);
writeFileSync(`${here}/pre-nft-contract/Cargo.toml`, `[package]
name = "zinc-pre-nft-rehearsal"
version = "0.1.0"
edition = "2021"
[lib]
crate-type = ["cdylib", "rlib"]
[dependencies]
near-sdk = "=5.30.0"
`);
console.log('Prepared isolated pre-NFT fixture with campaigns + claimed/pending Borsh layout.');
