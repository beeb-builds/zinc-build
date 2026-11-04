import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export function writeReport(report) {
  if (!report.success) throw new Error('Cannot write a successful rehearsal report from failed results');
  const tx = report.transactions;
  const callbackTgas = (gas) => (Number(BigInt(gas)) / 1e12).toFixed(6); // display-only gas, never token math
  const text = `# Zinc NFT upgrade sandbox rehearsal — 2026-10-31

**Result: PASS. No public-network deployment or transaction was performed.**

Framework: ${report.framework}; NEAR node ${report.node.version.version}, protocol
${report.node.protocolVersion}, commit ${report.node.version.commit}. Linux Docker
runtime: Node 22 on Debian Trixie. RPC was loopback-only inside the container,
with no published port, wallet files, testnet endpoint, or testnet keys.

## Fixture and preservation

Two local campaigns (IDs 0 and 1) received 10 and 8 NEAR. The treasury completed
a real 4 NEAR claim before the upgrade. Alice still had 2.5 NEAR unclaimed in
campaign 0. The pre-NFT source reproduces the deployed claims schema and method
bodies; this was **synthetic equivalent state, not a byte-for-byte live backup**.

The main upgrade deployed the NFT artifact and invoked private migrate_nfts()
in one atomic transaction signed by the local contract account.

- Campaign count, IDs, order, every campaign field, and deposited totals: preserved.
- Entire serialized financial prefix (campaigns plus claimed/pending map): byte-identical.
- All existing claimed and claimable views: unchanged for all fixture beneficiaries.
- Exactly six NFTs minted, one per contributor, with expected owners and token IDs.
- Treasury NFT count: zero.
- Repeated migration: rejected, with raw state and NFT supply unchanged.

## Real transfer and payout receipts

Alice transferred campaign:0:right:0 to Bob with exactly one yoctoNEAR attached.
Ownership changed in the real sandbox runtime.

- Alice retained her historical 2.5 NEAR; Bob could claim none of that history.
- A later 10 NEAR deposit added 2.5 NEAR to Bob and zero to Alice.
- Bob and Alice each subsequently claimed 2.5 NEAR.
- Bob's wallet net increase was ${report.bobPayout.walletNetIncreaseNear} NEAR;
  Alice's was ${report.alicePayout.walletNetIncreaseNear} NEAR (net of transaction fees).
- Payout callbacks returned true, claimable balances became zero, and claimed
  views became 2.5 NEAR each. All descendant and refund receipts reached FINAL.

## Gas measurements

Gas below includes transaction, execution, descendant, and refund outcomes.
A second equivalent fixture measured migration separately from code deployment.

| Operation | Tgas |
| --- | ---: |
| migrate_nfts only, full transaction | ${tx['migration-only'].tgas} |
| Atomic NFT deploy + migrate, full transaction | ${tx.migrationAtomic.tgas} |
| NFT transfer, full transaction | ${tx['nft-transfer-alice-bob'].tgas} |
| Bob claim + payout + callback + refunds | ${tx['post-transfer-bob-claim'].tgas} |
| Bob callback receipt alone | ${callbackTgas(report.bobPayout.callbackGas)} |
| Alice historical claim, all receipts | ${tx['post-transfer-alice-claim'].tgas} |
| Alice callback receipt alone | ${callbackTgas(report.alicePayout.callbackGas)} |

The existing 20 Tgas payout callback allocation was sufficient for this fixture.
The primary migration was given 300 Tgas; transfer and claim calls were given
100 Tgas. Results prove these paths for the fixture, not arbitrary larger state.

## Storage and recommended funding

- Pre-upgrade storage usage: ${report.storage.beforeBytes} bytes.
- Post-upgrade storage usage: ${report.storage.afterBytes} bytes.
- Total growth: ${report.storage.totalGrowthBytes} bytes.
- Code growth: ${report.storage.codeGrowthBytes} bytes; new NFT/accounting state: ${report.storage.stateGrowthBytes} bytes.
- Storage price: ${report.storage.byteCostYocto} yoctoNEAR per byte.
- Additional storage stake: ${report.storage.extraStakeNear} NEAR.
- Full post-upgrade storage stake: ${report.storage.finalTotalStorageStakeNear} NEAR.
- Outstanding beneficiary liability at migration: ${report.balanceRecommendation.outstandingBeneficiaryLiabilitiesNear} NEAR.
- Calculated pre-migration balance floor including a conservative gas budget:
  ${report.balanceRecommendation.calculatedPreMigrationFloorNear} NEAR.
- **Recommended balance for this fixture: at least ${report.balanceRecommendation.recommendedTotalBalanceBeforeMigrationNear} NEAR total**,
  including beneficiary revenue, storage stake, gas, and headroom.

For live migration, calculate:

outstanding beneficiary revenue + full post-upgrade storage stake + migration
transaction gas budget + at least 1 NEAR of headroom, rounded up.

Do not treat 20 NEAR as an unconditional live quote. The fixture owes 14 NEAR;
the deployed contract may have different liabilities, token counts, and storage.
Beneficiary deposits must not be counted as free NFT storage funding.

## Artifacts and remaining risk

Pre-NFT WASM: ${report.artifacts.legacy.size} bytes,
SHA-256 ${report.artifacts.legacy.sha256}.

NFT WASM: ${report.artifacts.nft.size} bytes,
SHA-256 ${report.artifacts.nft.sha256}.

results.json records all measurements and transaction hashes. receipt-*.json
contains raw public local-chain receipts. before.json and after-migration.json
contain financial snapshots and raw state evidence. No private keys are reported.

No Zinc production bug was found, and no production contract or frontend code
was changed. Only isolated rehearsal tooling, fixture source, dependencies, and
reports were added. Startup required a Linux cache volume to avoid the sandbox
package's cross-device rename issue, and a newer glibc container image.

**Deployment assessment:** the equivalent-state sandbox rehearsal passed,
including actual transfers and asynchronous payouts. This supports the design
for the tested scale. Before live deployment, back up and verify exact deployed
state/code, recalculate funding and gas for that state, review this evidence,
and obtain explicit deployment authorization. This report does not authorize or
claim completion of a testnet deployment. Larger state and other asynchronous
interleavings still need their own coverage.
`;
  writeFileSync(new URL('artifacts/REPORT.md', import.meta.url), text);
  return text;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  writeReport(JSON.parse(readFileSync(new URL('artifacts/results.json', import.meta.url), 'utf8')));
  console.log('Wrote artifacts/REPORT.md from the completed sandbox evidence.');
}
