# Fresh Testnet demo deployment

Prepared November 5, 2026 at the owner's request. This is a separate deployment,
not a reset or migration of existing campaigns.

| | Fresh demo | Previous deployment |
| --- | --- | --- |
| Contract | `zinc-demo-2026.testnet` | `zinc-builder-2026.testnet` |
| App | https://zinc-demo-production.up.railway.app | https://zinc-build-production.up.railway.app |
| Initial verified campaign count | 0 | 8 |
| Initial verified NFT supply | 0 | 16 |

The new contract was created by the Testnet faucet, then deployed with `new()`
in the same transaction. No existing contract was upgraded and no balances,
NFTs, campaigns or claims were moved. The deployment key is stored in the
owner's local CLI keychain; never commit or share it.

- Account creation: `2CXXjKgoZ84yrYz3DJR99uoUgSNLXidgnU6d94oD8ASL`.
- Deploy and initialize: `7QRxLNazFQaGkSbY6duA9M8oncDtkqT9KsysWLxRW4rz`.
- WASM: 402252 bytes, SHA-256
  `4a9d7f8ed5cc4aa81e9badbd169ab51dffb8b6b483dc6ee89b556a53198ae4a5`.
- Finalized account code hash matches both deployments:
  `62GTnrKwSXNEV35gfgoCczwDx8te5RWJPqsB5F5BoNNY`.
- Before deployment: 69 contract tests and `cargo near check` passed;
  `cargo near build non-reproducible-wasm --no-abi` succeeded.

## Frontend and storage isolation

Set `NEXT_PUBLIC_ZINC_CONTRACT_ID=zinc-demo-2026.testnet` **before building** the
fresh frontend. Without the override the original contract remains the default.
Wallet signing, reads, receipt verification and activity scopes share this value.
The read-only baseline helper also accepts this environment override.

The fresh app uses a separate Railway service and persistent `/data` volume.
Do not reuse the previous workspace database: its briefs are keyed by campaign
ID, not contract. Separate origins isolate browser drafts and wallet/session
storage; transaction journals and shared activity also include the contract.
The old app stays available for existing claims. Fresh-demo Settings links to it.

## Proposed initial campaigns

The owner accepted these demo setups for preparation. They remain unpublished
until reviewed and signed in the connected wallet.

- **Coral Studio: Demo**: creative release revenue. A Artist 60%, B Producer 20%,
  B account-based treasury 20%.
- **Orbit Indie Game: Demo**: game sales revenue. A Developer 40%, B Designer 30%,
  B account-based treasury 30%.
- Both use approximately 90-day support windows beginning on creation day.
- A: `77d96ac24fa9038a4be43b70f51a9bb52dda3bc074137fddb16ce5cf459dd92b`.
- B: `d500c193b9052dd191dc69793180e5dec0cb3ee2bec9adaec646753487646671`.

Each campaign totals 100% and mints two contributor NFTs. Treasury does not
receive an NFT. Demo roles describe sample allocations, not real employment.
