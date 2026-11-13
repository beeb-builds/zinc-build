# Zinc

Zinc lets teams split project revenue and give each contributor an NFT that controls their share. When someone transfers that NFT, future revenue goes to the new owner. Anything earned before the transfer stays with the previous owner.

The idea is simple: a team should be able to define its revenue agreement once, see where the money goes, and let contributors pass on their future share without losing what they have already earned.

[Try the demo](https://zinc-demo-production.up.railway.app) · [View the NFTs](https://zinc-demo-production.up.railway.app/gallery) · [Contract on NEAR Blocks](https://testnet.nearblocks.io/address/zinc-demo-2026.testnet)

The app runs on **NEAR Testnet**. Use testnet NEAR for deposits and gas.

## How it works

1. Create a campaign with contributor wallets, roles, shares and a treasury account.
2. Zinc mints one revenue-right NFT for each contributor. The treasury keeps an account-based share.
3. Deposit NEAR into the campaign. The contract tracks what each account has earned.
4. Contributors and the treasury claim their available revenue through their wallets.
5. Transfer a contributor NFT to pass its share of future deposits to another account.

For example, a studio could allocate 60% to an artist, 20% to a producer and 20% to its treasury. The artist and producer each receive an NFT. The treasury allocation does not need one.

Revenue comes from deposits made into the campaign. Holding an NFT does not guarantee income, and Zinc does not automatically collect a project's external sales.

## Try it

The demo has two projects: [Coral Studio](https://zinc-demo-production.up.railway.app/campaigns/0) and [Orbit Indie Game](https://zinc-demo-production.up.railway.app/campaigns/1).

Start with Coral Studio to see its team, allocation and NFTs. Open the Artist NFT to compare its original contributor with its current owner. You can browse all of this without connecting a wallet.

After connecting, **My NFTs** shows the rights you own and known transferred rights. **Earnings** shows your claimed and claimable amounts, including revenue you kept after a transfer. A new wallet can have no rights or earnings, even while the public campaigns have activity.

Campaigns also have a private workspace. Current NFT holders can request access by signing a message. The creator can publish the brief, and the server checks ownership again on each protected request.

The [demo guide](docs/JUDGE_DEMO.md) has a longer walkthrough.

## What we tested on-chain

We ran this sequence on Coral Studio on November 5, 2026. Wallet A started with the 60% Artist NFT. Wallet B held the 20% Producer NFT and the 20% treasury share.

| Action | A claimable | B claimable |
| --- | ---: | ---: |
| Deposit 0.01 NEAR | 0.006 NEAR | 0.004 NEAR |
| Transfer the Artist NFT from A to B | 0.006 NEAR | 0.004 NEAR |
| Deposit another 0.01 NEAR | 0.006 NEAR | 0.014 NEAR |
| Both accounts claim | 0 NEAR | 0 NEAR |

A received its original 0.006 NEAR. B received 0.014 NEAR: its first 0.004, plus the entire second deposit after it held both contributor rights and the treasury share. Both payouts and their callbacks completed successfully.

The [deployment notes](docs/FRESH_DEMO_DEPLOYMENT.md#recorded-deposit-transfer-and-claim-walkthrough) include the transaction links. These describe the recorded test; check the app for current ownership and balances.

## Under the hood

The frontend uses Next.js, TypeScript, Tailwind and NEAR Wallet Selector v10. The Rust contract uses `near-sdk` and the official `near-contract-standards`, both pinned to 5.30.0, for its NEP-171 NFTs.

Deposited funds stay in the Zinc contract until claimed. Before an NFT changes owners, the contract credits the outgoing owner's earnings and records where the new owner's revenue starts. Historical credits remain attached to the account that earned them. NFTs control revenue rights; they do not have separate wallet subaccounts.

Shares use basis points, and amounts use integer yoctoNEAR accounting. The frontend uses decimal strings and `BigInt` for token amounts. Claims reserve the amount before sending NEAR, then use a private callback to confirm the payout or restore the claimant's balance if the transfer fails.

See the [accounting design](docs/MILESTONE_5_NFT_ACCOUNTING.md) and [workspace security notes](docs/holder-workspace.md) for the details.

## Run locally

You need Node.js 22.13 or later with `node:sqlite`, npm and a browser. To use the same contract as the hosted demo, run these commands in PowerShell:

```powershell
npm ci
$env:NEXT_PUBLIC_ZINC_CONTRACT_ID = "zinc-demo-2026.testnet"
npm run build
npm run start
```

Open <http://localhost:3000>. For development, use `npm run dev` instead of building and starting the production server.

Set `NEXT_PUBLIC_ZINC_CONTRACT_ID` before building because Next.js includes it in the client bundle. Without it, the app defaults to the earlier `zinc-builder-2026.testnet` contract. Network and RPC settings are in [src/lib/near.ts](src/lib/near.ts). The configured RPC is `https://test.rpc.fastnear.com`.

Public reads do not need a wallet. Deposits, claims and NFT transfers require a connected Testnet wallet. No server-side wallet key is needed to run the app.

### Hosting

The Railway app uses SQLite for workspace briefs and verified activity records. It needs a persistent writable volume. The hosted service mounts that volume at `/data` and uses:

| Variable | Value |
| --- | --- |
| `ZINC_WORKSPACE_DB` | `/data/zinc-workspace.sqlite` |
| `ZINC_ACTIVITY_DB` | `/data/zinc-activity.sqlite` |
| `ZINC_PUBLIC_ORIGIN` | `https://zinc-demo-production.up.railway.app` |

Set the public origin to your own HTTPS domain if you host another instance. It binds workspace signatures and sessions to that site. Local development uses the request origin and stores its databases under `data/`, which is gitignored.

The [previous app](https://zinc-build-production.up.railway.app) still serves the original contract and its campaigns. The fresh demo has its own contract, service and storage. Existing campaigns and claims were not moved or deleted.

## Checks

Frontend lint and production build:

```powershell
npm run lint
npm run build
```

Contract tests and WASM build:

```powershell
Set-Location contracts/zinc-contract
cargo test
cargo near check
cargo near build non-reproducible-wasm --no-abi
```

The recorded verification includes 69 contract unit tests and 31 frontend regression scripts. The [release report](docs/RELEASE_ACCEPTANCE.md) covers the hosted checks and earlier transaction tests. The [sandbox rehearsal](scripts/nft-sandbox/README.md) has separate instructions and requires Docker.

## Current limits

Zinc is a hackathon prototype and has not had an independent security audit. The contract can be upgraded by its administrator.

There is no marketplace or sale settlement. Transfers move the revenue right directly. The activity page shows transactions the app has recorded or imported and verified, so it is not a complete chain history.

Mobile wallet connection still needs further testing. Desktop extension wallets are the clearest path through the demo. Known connection and recovery behavior is documented in [wallet session recovery](docs/WALLET_SESSION_RECOVERY.md).

Workspace access can be revoked when ownership changes, but material someone has already copied cannot be taken back. Briefs are stored as plaintext on the app host.

## About the build

Zinc was built for the **NFTs That Do Something** track. It started from `create-next-app` and was developed with Codex assistance. The earliest recorded local commit is October 27, 2026; that establishes repository history, not when every part of the code was first written. The [submission checklist](docs/SUBMISSION_CHECKLIST.md) records the remaining development-history disclosure and submission details.

## License

[MIT](LICENSE). Third-party dependencies retain their own licenses.
