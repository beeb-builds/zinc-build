# Zinc

**Transferable rights to future project revenue on NEAR.**

Zinc lets teams create campaign revenue splits, mint a revenue-right NFT for each
contributor, receive native NEAR deposits and claim earnings. Transferring a right
moves future revenue to its new owner. Previously earned revenue stays claimable
by the former owner.

This is a NEAR Testnet prototype. Earnings come from actual deposits; creating or
holding a right does not guarantee revenue.

Repository: [beeb-builds/zinc-build](https://github.com/beeb-builds/zinc-build).
The earlier [clean-release QA report](docs/QA_BATCH_9.md) records a passing clean working-tree
install/build/lint, 24 regressions, 45 responsive browser checks and NFT motion /
reduced-motion checks. Hosted wallet-signing acceptance remains a separate check.
The Testnet app is hosted on Railway at
[zinc-build-production.up.railway.app](https://zinc-build-production.up.railway.app).
The [product discovery update](docs/PRODUCT_DISCOVERY.md) separates the personal
dashboard from Explore Zinc and adds public NFT discovery and project rosters.

## Run locally

Requirements: Node.js **22.13+** with native **node:sqlite**, npm and a browser.
Public campaign/NFT details work without connecting. Transactions need a Testnet
wallet with testnet NEAR for deposits and gas.

~~~powershell
npm ci
npm run build
npm run start
~~~

Open <http://localhost:3000>. Default setup requires no environment file or
server-side wallet key. Configuration is in [src/lib/near.ts](src/lib/near.ts):

| Setting | Value |
| --- | --- |
| Network | NEAR Testnet |
| Contract | zinc-builder-2026.testnet |
| Application RPC | https://test.rpc.fastnear.com |
| Explorer | [Contract on NEAR Blocks](https://testnet.nearblocks.io/address/zinc-builder-2026.testnet) |

Use **npm run dev** for development. Stop the production server before rebuilding
its .next directory, then restart after the build. Replacing assets underneath a
running older server can cause missing CSS/JavaScript. Starting the app does not
deploy a contract or run a migration.

### Mobile wallet connections

Nightly and Sender use injected NEAR extension providers. A separate installed
phone app does not automatically connect to a regular browser. Extension-capable
mobile browsers must expose the wallet's NEAR provider, and the wallet must be
able to reach NEAR Testnet. Nightly's own "could not connect ... Near network"
screen requires troubleshooting within the wallet/network; Zinc cannot change
the wallet's internal RPC configuration.

Zinc checks Nightly's live injected session before signing and offers explicit
reconnection when cached accounts are stale. It never automatically resubmits
a transaction. See [wallet session recovery](docs/WALLET_SESSION_RECOVERY.md)
for tested behavior and remaining real-device checks.

The build/dev pre-hooks apply a version-guarded compatibility patch to Sender
10.1.4: its mobile exclusion is relaxed only when `window.near.isSender` is
already present. Official signing methods remain unchanged. Ordinary mobile
browsers without that provider still do not list Sender. Review the patch before
upgrading the Sender adapter. Run `node scripts/check-sender-mobile.cjs` to verify it.

## Judge walkthrough: do X, see Y

[The demo guide](docs/JUDGE_DEMO.md) contains a public tour, a fresh two-wallet
scenario and exact expected amounts.

| Do this | See this |
| --- | --- |
| Open / | Personal wallet balances, NFT counts, related campaigns and creator/contributor/visitor onboarding. No platform statistics on this page. |
| Open /explore | Shared platform totals, real campaign revenue charts and public discovery links. |
| Open /gallery without a wallet | Minted revenue-right NFTs, token IDs, current owners, project filters and links to team/NFT details. |
| Open /campaigns | On-chain campaigns, status, dates and deposited totals. |
| Open /campaigns/7 | Acceptance campaign, creator/contributor/treasury roster, visible NFTs, original versus current owners, and deposit/claim section links. |
| Open /rights/campaign%3A7%3Aright%3A0 | Actual NFT, current owner and available ownership history. |
| Connect a Testnet wallet; open /nfts | Current and known transferred rights; an unrelated wallet may own none. |
| Open /earnings connected | Campaign/account claimed and claimable amounts, including historical earnings. |
| Open /transactions | Verified app-recorded activity and explicit indexing limitations. |
| Open /workspace/7 | Eligibility preview; private access requires a signed message and server authorization. |

Settings shows the actual network/RPC/wallet configuration. The /pay/{id} page
accepts campaign support. Charts use real campaign totals, not invented history.

## What the NFT controls

Every contributor slot has an immutable campaign, role and basis-point share.
One NFT is minted per slot, with ID **campaign:{campaign_id}:right:{index}**,
where index is zero-based. Treasury is account-based and receives no NFT unless
its account is separately listed as a contributor.

Original contributor accounts stay in campaign history. Current NFT ownership
controls that right's future revenue. Campaign dates limit new deposits, not
already-earned claims.

Example: A owns the 60% right; B is the 40% treasury:

| Action | A claimable (NEAR) | B claimable (NEAR) |
| --- | ---: | ---: |
| Deposit 0.01 | 0.006 | 0.004 |
| A transfers NFT to B | 0.006 | 0.004 |
| Deposit another 0.01 | 0.006 | 0.014 |
| Both claims complete | 0 | 0 |

B's 0.014 is 0.008 treasury plus 0.006 post-transfer NFT earnings. A keeps its
original 0.006.

## Architecture and exact accounting

~~~mermaid
flowchart LR
  App[Next.js and Wallet Selector] -->|signed calls / public views| Zinc[Zinc NEAR contract]
  Zinc -->|reserved claim and Promise payout| Account[Claimant]
  App -->|signed challenge / activity hash| Server[Node server]
  Server -->|finalized verification| Zinc
  Server --> DB[(SQLite)]
~~~

- Contract: Rust, official **near-sdk** and **near-contract-standards**, pinned
  to **5.30.0**. Source: [contracts/zinc-contract](contracts/zinc-contract).
- App: Next.js **16.4.3**, React, TypeScript, Tailwind, near-api-js and multi-wallet
  Wallet Selector v10. Users sign through their wallets.
- Deposits stay in Zinc's central contract until claimed. There are no per-token
  subaccounts or wallet keys transferred with an NFT.
- Before ownership changes, the contract credits the outgoing owner's interval
  and checkpoints that right's deposited total. Later deposits accrue from the
  checkpoint to the new owner.
- Checked integer accounting uses basis points (25% = 2500 bps). Fractional
  yoctoNEAR remainders stay with the earning account. Aggregate entitlement is
  floored to whole yoctoNEAR for claims. Frontend amounts use decimal strings and
  BigInt: **1 NEAR = 10^24 yoctoNEAR**.
- Claim accounting is reserved before the external Promise transfer. The private
  callback completes the reservation or restores the original claimant on
  failure. A wallet signature alone does not prove payout success.

See [the accounting design](docs/MILESTONE_5_NFT_ACCOUNTING.md). Its original
deployment-status notes are historical; later live evidence is recorded below.

## Transfer security and holder access

| Risk | Implemented boundary |
| --- | --- |
| Seller takes later deposits | Ownership checkpoint settles the seller's interval before transfer. |
| Buyer takes historical revenue | Historical credits remain in the former owner's campaign/account ledger. |
| Duplicate claim or transfer during payout | Claimed/pending reservations precede payout; callback stays with the original claimant. |
| Non-owner transfers a token | Contract NFT authorization is authoritative; UI also checks fresh ownership. Standard transfer attaches exactly one yoctoNEAR. |
| Former holder reuses workspace session | Server rechecks the session's registered full-access key and finalized ownership on every protected request. |

The workspace uses NEP-413 challenges, expiring server sessions and HttpOnly
cookies. Current holders may read; the immutable creator has separate editorial
read/publish access. Original contribution or treasury status alone grants no
holder access. Revocation cannot erase material already copied.
See [the workspace threat model](docs/holder-workspace.md).

This prototype has no independent security audit. Contract upgrade authority
and the application host remain trust boundaries. State growth needs storage
reserve and gas headroom; callback failure can leave a pending operation requiring
investigation.

## Server storage and hosting

| Optional variable | Default |
| --- | --- |
| ZINC_WORKSPACE_DB | data/zinc-workspace.sqlite |
| ZINC_ACTIVITY_DB | data/zinc-activity.sqlite |
| ZINC_PUBLIC_ORIGIN | Request URL origin (local development) |

Behind an HTTPS reverse proxy, set `ZINC_PUBLIC_ORIGIN` to the exact public
origin, for example `https://zinc-build-production.up.railway.app`. This binds
workspace signatures, sessions, secure cookies and same-origin API checks to
the public app rather than the internal container URL. It does not trust
client-supplied forwarded headers. Update this setting if the public domain changes.
The Railway service mounts a persistent volume at `/data`, with both database
paths set to `/data/zinc-workspace.sqlite` and `/data/zinc-activity.sqlite`.

Use writable persistent disk and appropriate database/WAL backups. The data
directory is gitignored; a fresh checkout has empty app databases. On-chain state
is unaffected. Native SQLite may emit an experimental-runtime warning.

Independent ephemeral/serverless instances do not share these files. Use a
durable shared database design before hosting that way. Use HTTPS publicly;
session cookies are Secure on HTTPS. Briefs are plaintext on the host and should
contain no secrets or wallet recovery material.

## Verification and evidence

On **November 3, 2026**, campaign #7 completed the two-wallet scenario: A retained
and claimed **0.006 NEAR** after transfer; B claimed **0.014 NEAR**. Both claims
reached FINAL with successful payout callbacks, both claimable values became
zero, and B owned the NFT at finalized block **276052836**. A's saved workspace
session was denied after transfer. See [the acceptance report](docs/TWO_WALLET_ACCEPTANCE.md)
for public hashes and block evidence.

**Later change:** the user subsequently signed a return transfer. At finalized
block **276057974**, A owned the NFT again. Claimed amounts stayed A 0.006 / B
0.014, both claimable zero, deposits 0.02. The earlier run describes historical
observations; do not present its B ownership as today's guaranteed state.
After a further user-confirmed transfer, block **276058888** showed B owning it
again, with those same claimed/deposit totals and zero claimable for both.
Always inspect the live owner rather than assuming a recorded snapshot persists.

Latest frontend verification: **30 regression scripts**, lint and production
build passed. These fixtures cover exact amounts, wallet lifecycle, recovery,
ownership refresh, authorization and RPC failures. They do not certify every
wallet/browser combination. From the repo root:

~~~powershell
npm run lint
Get-ChildItem scripts -Filter 'check-*.cjs' | Sort-Object Name | ForEach-Object {
  node $_.FullName
  if ($LASTEXITCODE -ne 0) { throw "Failed: $($_.Name)" }
}
npm run build
~~~

Contract checks require Rust and cargo-near:

~~~powershell
Set-Location contracts/zinc-contract
cargo test
cargo near check
cargo near build non-reproducible-wasm --no-abi
~~~

[The sandbox rehearsal](scripts/nft-sandbox/README.md) requires a running Docker
engine. It uses a reconstructed pre-NFT fixture, not an exact downloaded
production backup. On November 4, `cargo test --offline` passed all **69** unit
tests. The Docker sandbox rehearsal was not rerun for this documentation update.
Do not run migration initializers as part of a live demo.

The [release acceptance report](docs/RELEASE_ACCEPTANCE.md) distinguishes hosted
public-page checks, recorded financial evidence and pending manual checks. A
read-only recheck at finalized block **276220305** found campaign #7's right
owned by A, with deposits and claimed values unchanged. Ownership is a
point-in-time observation, not a permanent property of the demo.

On November 5, a further hosted financial retest passed deposits, NFT transfer,
historical/future revenue separation and completed payouts. At finalized block
**276278897**, campaign #7 had **0.041 NEAR deposited**, A claimed **0.0126 NEAR**,
B claimed **0.0284 NEAR**, both claimable zero, and B owned the NFT. The totals
reconcile exactly. See [public transaction proofs and wallet-recovery limits](docs/RELEASE_ACCEPTANCE.md#live-deposits-and-claim-retest-november-5-wat).

## Scope and limits

- Native NEAR support is an explicit campaign deposit. External project income
  is not automatically collected; off-chain agreements are not enforced.
- There is no marketplace or sale settlement. Direct transfer is not evidence
  of a sale during a payout.
- Activity is a verified partial record, not a full chain index. Older
  transactions need hash/signer import while RPC evidence remains available.
  Claims are campaign/account payouts, not individual NFT payouts.
  See [shared activity](docs/shared-activity.md).
- Workspace signing supports direct NEP-413 responses; redirect recovery is
  limited. Broader rejection/offline, physical-device and hosting QA remains on
  [the readiness checklist](docs/HACKATHON_READINESS.md).
- Local generated snapshots/receipts under data are gitignored. Public hashes
  in the acceptance report remain reviewable.

## Track and development provenance

Target track: **NFTs That Do Something (nfts)**. Zinc demonstrates revenue and
access controlled by ownership. The [official rules](https://nearhackathon.com/HACKATHON.md),
checked November 4, 2026 (Q-011 and Tracks), make integrations optional and
starter prompts examples. NFT-controlled subaccounts are not implemented here.
Recheck live rules before submission.

The app started from create-next-app, uses the dependencies in package.json /
Cargo.toml, and was developed with Codex assistance. The earliest recorded local
commit is `d14f375d74949ad288ebeb3bd0378c9e50c3228d` (October 27, 2026), which
contains only `.gitignore`. The reviewed application release is
`c80fd0a5c2c3890095d8f6c13cfdee1f7f4f11d6` (November 4). See the
[recorded source comparison](https://github.com/beeb-builds/zinc-build/compare/d14f375d74949ad288ebeb3bd0378c9e50c3228d...c80fd0a5c2c3890095d8f6c13cfdee1f7f4f11d6).
Commit dates establish repository history, not when all code was first written.
Earlier Zinc work still needs owner confirmation; see the
[submission checklist](docs/SUBMISSION_CHECKLIST.md) before submission.

## License

Zinc's original source code is licensed under the [MIT License](LICENSE).
Third-party dependencies retain their respective licenses.
