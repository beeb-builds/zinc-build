# Zinc NFT upgrade sandbox rehearsal — 2026-10-31

**Result: PASS. No public-network deployment or transaction was performed.**

Framework: near-sandbox 0.3.4 + near-api-js 7.2.0; NEAR node 2.14.0, protocol
88, commit bc4e9e8cfb03d9e82f027883055624e18576993e. Linux Docker
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
- Bob's wallet net increase was 2.4994969204253477 NEAR;
  Alice's was 2.4995028394563404 NEAR (net of transaction fees).
- Payout callbacks returned true, claimable balances became zero, and claimed
  views became 2.5 NEAR each. All descendant and refund receipts reached FINAL.

## Gas measurements

Gas below includes transaction, execution, descendant, and refund outcomes.
A second equivalent fixture measured migration separately from code deployment.

| Operation | Tgas |
| --- | ---: |
| migrate_nfts only, full transaction | 14.947626470336 |
| Atomic NFT deploy + migrate, full transaction | 43.940512759264 |
| NFT transfer, full transaction | 3.981530890366 |
| Bob claim + payout + callback + refunds | 5.700343434023 |
| Bob callback receipt alone | 1.741673 |
| Alice historical claim, all receipts | 5.641153124096 |
| Alice callback receipt alone | 1.748228 |

The existing 20 Tgas payout callback allocation was sufficient for this fixture.
The primary migration was given 300 Tgas; transfer and claim calls were given
100 Tgas. Results prove these paths for the fixture, not arbitrary larger state.

## Storage and recommended funding

- Pre-upgrade storage usage: 186721 bytes.
- Post-upgrade storage usage: 409777 bytes.
- Total growth: 223056 bytes.
- Code growth: 216392 bytes; new NFT/accounting state: 6664 bytes.
- Storage price: 10000000000000000000 yoctoNEAR per byte.
- Additional storage stake: 2.23056 NEAR.
- Full post-upgrade storage stake: 4.09777 NEAR.
- Outstanding beneficiary liability at migration: 14 NEAR.
- Calculated pre-migration balance floor including a conservative gas budget:
  18.13777 NEAR.
- **Recommended balance for this fixture: at least 20 NEAR total**,
  including beneficiary revenue, storage stake, gas, and headroom.

For live migration, calculate:

outstanding beneficiary revenue + full post-upgrade storage stake + migration
transaction gas budget + at least 1 NEAR of headroom, rounded up.

Do not treat 20 NEAR as an unconditional live quote. The fixture owes 14 NEAR;
the deployed contract may have different liabilities, token counts, and storage.
Beneficiary deposits must not be counted as free NFT storage funding.

## Artifacts and remaining risk

Pre-NFT WASM: 185860 bytes,
SHA-256 57365cb27b361c93302d4bb31a04dc155c4e304ecfe7294eb99b341f41fcfa08.

NFT WASM: 402252 bytes,
SHA-256 4a9d7f8ed5cc4aa81e9badbd169ab51dffb8b6b483dc6ee89b556a53198ae4a5.

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
