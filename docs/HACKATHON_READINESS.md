# Zinc readiness checkpoint

Latest audit: 2026-11-05 (WAT). This is the finish-line checklist, not a new feature backlog.
Each next batch should contain two named tasks with results recorded here.

## Current release checkpoint: November 4

The public repository and Railway deployment are live. Personal onboarding,
Explore Zinc, the public NFT gallery and project team rosters are implemented.
The current release is `c80fd0a5c2c3890095d8f6c13cfdee1f7f4f11d6`.
See [release acceptance](RELEASE_ACCEPTANCE.md) for dated verification and
[submission preparation](SUBMISSION_CHECKLIST.md) for remaining owner actions.
Old hosting failures below are historical records, not the current deployment.

Two finishing tasks: audit the release evidence and prepare the README/judge
walkthrough. MIT is now selected and the LICENSE file is added. Physical-phone
wallet acceptance, fresh hosted signed flows, development-provenance confirmation
and the human's demo post remain outstanding.
No new contract deployment is needed for these tasks.

## Historical progress: batch 9

[QA_BATCH_9.md](QA_BATCH_9.md): phone layout/font-cascade fixes, compact bottom
navigation, mobile campaign cards and reduced-motion-aware NFT animation.
The combined browser run passed all 45 route/viewport checks and orbit/reduced
motion checks. Local production build and 24 regressions passed. The new clean
export passed install/build/lint and all 24 regression scripts.
Railway configuration passed schema validation. Project creation was rejected
because the trial expired; the user explicitly kept deployment pending.
No cloud deployment or contract update was performed.

## Previous progress: batch 8

[QA_BATCH_8.md](QA_BATCH_8.md): real SQLite store persistence passed across
independent Node processes using synthetic temporary databases. A clean
working-tree export was attempted, but `npm ci` timed out after ten minutes;
its build/lint/regression stages did not run. Clean reproduction remains open.
[LOCAL_RELEASE_VERIFICATION.md](LOCAL_RELEASE_VERIFICATION.md) documents both
commands and a proposed Railway persistent-volume setup. No host was deployed.

## Previous progress: batch 7

[QA_BATCH_7.md](QA_BATCH_7.md): the isolated results page now uses Zinc's
production CSS, readable results and a return-to-app link. All 11 browser checks
passed; desktop visual inspection confirmed the styled report and NFT preview.
The standalone script lint also completed with no errors or warnings.
The isolated QA page is not part of the production app or evidence of full
release readiness. Next release work is clean-checkout reproduction, persistence
verification on the intended host, and final demo/submission preparation.

## Previous progress: batch 6

[QA_BATCH_6.md](QA_BATCH_6.md): all ten isolated real-React-DOM checks passed,
including focus refresh, failed read/retry, lost ownership and account switching.
No wallet or RPC access was available to that fixture. A separate finalized
read confirms wallet A currently owns campaign #7's NFT; deposits remain 0.02
NEAR, claimed totals A 0.006 / B 0.014 NEAR, both claimable zero.
This completes the component draft-preservation check, not full submission QA.

## Previous progress: batches 4–5

[QA_BATCH_4.md](QA_BATCH_4.md): the transfer-draft reset fix, all 23 frontend
regression scripts, full lint and production build passed. Real browser draft
preservation was subsequently verified in the isolated fixture in batch 6;
see [QA_BATCH_5.md](QA_BATCH_5.md) for the earlier interrupted live checks.

[README.md](../README.md) now explains the product, custody/accounting/security,
setup, verification and limits. [JUDGE_DEMO.md](JUDGE_DEMO.md) supplies public
inspection steps, a fresh two-wallet walkthrough, recorded hashes and a video plan.
License, actual baseline/submission refs, clean-checkout verification, hosting and
public release/submission still require completion. No repository was pushed.

Track clarification (official HACKATHON.md, read November 3, 2026): Q-011 makes
integrations optional; Tracks identifies starter prompts as examples rather than
requirements. NFT-controlled subaccounts and sale settlement are not mandatory
under those published rules. Zinc's central-contract custody must remain explicit.
Source: https://nearhackathon.com/HACKATHON.md . Recheck before submission.

The user subsequently signed a return transfer B to A. At finalized block
276057974, A owned campaign #7's NFT again; claimed totals remained A 0.006 /
B 0.014 NEAR, both claimable zero. See the acceptance report for the later hash.
This does not invalidate the earlier A-to-B historical/future revenue proof.

## Previous progress: batch 3

See [QA_BATCH_3.md](QA_BATCH_3.md) for confirmed responsive-browser checks,
the creation-form overflow fix and the read-only wallet baseline helper.
All 22 regression scripts passed. On 2026-11-03 the core live two-wallet scenario
passed for campaign #7: creation, two 0.01 NEAR deposits, A-to-B NFT transfer,
historical/future earnings separation, A's existing workspace-session denial,
and both completed claims with FINAL successful payout callbacks. A claimed
0.006 NEAR; B claimed 0.014 NEAR; both claimable zero; B owns the NFT.
Finalized snapshots and transaction links are in
[TWO_WALLET_ACCEPTANCE.md](TWO_WALLET_ACCEPTANCE.md).
This was not a sale test or a complete browser acceptance certification. Additional
reload/rejection/offline/physical-device checks remain open. During this test,
the transfer review reset on focus-driven NFT reload; preserving the in-progress
form was fixed in batch 4, with browser verification tracked separately. The unstyled workspace was traced to a stale
port-3000 server and resolved by an authorized restart, with browser confirmation.
The production build and full lint passed. The rebuilt creation form was
visually rechecked at 320px, including contributor and treasury inputs.

## Previous progress: batch 2

See [QA_BATCH_2.md](QA_BATCH_2.md) for the lint cleanup, real public-browser
checks and an encoded NFT-detail-link defect discovered during QA. The earlier
167-error audit below is the historical baseline; the first cleanup lint run
reported zero errors/warnings; the final full lint run also passed. [LINT_POLICY.md](LINT_POLICY.md) documents the scoped
exceptions rather than claiming a wholesale effect-state rewrite.

The original 20 checks passed again and the new encoded-route regression passed.
The corrected encoded NFT URL was verified in the rebuilt browser and the final
production build passed. Public desktop smoke checks are recorded in the batch report.
Live signed two-wallet flows and narrow/mobile QA remain open acceptance items.

## Batch 1: automated QA and challenge audit

1. **Automated frontend QA: passed regression/build checks.** All 20
   `scripts/check-*.cjs` files completed with exit code 0. `npm run build` passed,
   including TypeScript and prerendering. These are fixtures, handler checks,
   cryptographic/SQLite checks and React rendering; they are not browser or live
   Sender tests. Native SQLite emits an experimental-runtime warning.
2. **Historical challenge audit.** The table
   below compares repository evidence to the specific challenge text supplied in
   the conversation. It does not establish current eligibility, deadlines or
   judging rules. The subsequent official-rule check above resolved the
   subaccount prompt as an example, not a mandatory integration.

`npm run lint` **failed: 167 errors, 0 warnings**. The existing baseline includes
CommonJS `require()` rule conflicts in regression scripts and React
`set-state-in-effect` findings in application components (including wallet,
transaction recovery and workspace UI). These were present when this audit ran;
the documentation-only batch does not fix or suppress them. A passing build is
not a clean lint result. Record and fix the baseline in a dedicated batch, with
regression checks after behavior changes.
No contract tests or sandbox rehearsal were re-run in this batch. No public
transaction, deployment or GitHub push was performed.

## Requirement-to-evidence matrix

| Supplied requirement | Repository evidence | Assessment / remaining work |
| --- | --- | --- |
| Functional NEP-171 NFTs | Official standards pinned to 5.30.0; `contracts/zinc-contract/src/nft.rs`; deterministic contributor tokens and revenue checkpoints | Implemented in source. User reports live deployment; current deployed bytecode and supply were not independently re-queried in this batch. |
| Each NFT controls a sub-account with its own wallet | Revenue is held by Zinc; rights checkpoint earnings into campaign/account ledgers. No per-token account creation or key rotation was found in the reviewed contract. | **Not implemented.** Do not claim NFT wallets or balances that travel with a token. |
| Wallet balance moves with a membership NFT | Historical earned revenue stays with the former owner; only future revenue follows ownership | **Different semantics.** Explain Zinc's revenue-agreement model; it does not satisfy a literal requirement to transfer an existing wallet balance. |
| Gated current-holder page | `/workspace/[id]`; NEP-413, server sessions, fresh finalized key/ownership checks; `docs/holder-workspace.md` | Implemented with fixture coverage. Creator retains separate editorial access; it is not an exclusively holder-only page. Verify Sender signing and revocation in a real browser. |
| Per-NFT history: earnings, payouts, holders | `/rights/[tokenId]`, verified NEP-171 events, campaign/account earnings and claims; `docs/shared-activity.md` | **Partial.** Ownership events have coverage gaps. Aggregate claims cannot honestly be attributed to a single token. No complete per-token earned/paid-out ledger exists. |
| Transfer tests, including sale during payout | Contract tests include transfer during a pending claim and failure-refund attribution; synthetic sandbox report records actual transfers and successful claims | Transfer/payout evidence exists. **No sale settlement implementation or sale-during-payout proof.** Do not rename a direct transfer a sale. |
| README explains control transfer and old-owner access removal | Root README and docs/JUDGE_DEMO.md now link architecture, accounting, access revocation and live evidence | Written in batch 5; clean-checkout reproduction and release/provenance review remain. |
| Threat model before sub-account implementation | Current-model threats below; workspace threat model in `holder-workspace.md` | Design-only checkpoint. Any sub-account custody/key design requires separate review before implementation. |

The core narrative supported by the source is: **Zinc turns contributor revenue
agreements into transferable rights to future deposits while preserving each
former owner's accrued earnings.** It is not currently an NFT-owned wallet.

## Transfer threat model and limits

| Seller / attacker action | Current defense or limitation |
| --- | --- |
| Claim pre-transfer revenue after selling/transferring | Intentionally allowed for historical entitlement; it must not include later deposits. Ownership checkpoints distinguish the intervals. |
| Claim twice or race a transfer against a pending payout | Claimed/pending amounts are reserved before Promise transfer. Callback is private; failure restores the original claimant. Contract tests exercise pending-claim transfer behavior. |
| Forge ownership or transfer another account's NFT | Official NFT authorization plus exactly one yoctoNEAR for transfers; UI checks are advisory, contract checks are authoritative. |
| Abuse `nft_transfer_call`, forwarding or callback reversion | Checkpoints on actual ownership changes; resolver/private-callback tests exist. Gas exhaustion and unbounded state growth remain operational concerns. |
| Keep a saved holder session after transfer | Protected requests recheck finalized ownership and the registered full-access key. Creator editorial access intentionally persists. |
| Keep protected content already downloaded | Cannot be revoked. A previously authorized response or copied brief remains available to its recipient. |
| Keep a private key for an NFT's sub-account | No such account exists today. A future design must avoid permanent seller keys or revoke every relevant key and delegated authority; changing an owner label alone is insufficient. |
| Retain queued withdrawals, allowances or delegated permissions in a future NFT wallet | Not solved by current rights accounting. Define ordering, in-flight Promise behavior and complete authority revocation before building that wallet. |
| Spoof frontend history or a transaction hash | Shared activity verifies finalized contract execution and receipt evidence. Missing/pruned history is labeled; it is not complete indexing. |
| Exploit contract upgrade or hosting authority | Upgrade authority and server/database compromise remain trust boundaries. Neither NFT ownership nor the access gate eliminates them. |

This is a scoped threat review, not an independent security audit. Existing
accounting tests do not certify a future sub-account or marketplace design.

## Evidence already in the repository

- `scripts/nft-sandbox/artifacts/REPORT.md` records a successful local rehearsal
  dated 2026-10-31 with near-sandbox 0.3.4, NEAR 2.14.0 and real Promise receipts.
  It used synthetic equivalent pre-NFT state, not a live raw-state backup.
- `scripts/nft-sandbox/artifacts/results.json` and receipt files preserve that
  run's evidence. A `results-failed.json` also exists: identify run/artifact hashes
  rather than treating every generated file as evidence of success.
- That prior rehearsal is inspected evidence, not a newly executed test or proof
  that the current deployed contract matches the tested artifact.
- `docs/MILESTONE_5_NFT_ACCOUNTING.md` is an earlier implementation review with
  pre-deployment statements. Do not copy its historical deployment status into
  the final README as current fact.

## Browser and two-wallet acceptance tests still pending

Record environment, UTC time, account A/B, campaign/token IDs, transaction hashes
and screenshots for each completed case. Use a dedicated test campaign and small
testnet amounts. Do not infer success from the wallet prompt alone.

- [ ] Serve the production build on the intended host with HTTPS and persistent
  writable SQLite storage (Node 22.13+). Ephemeral independent server instances
  are not supported by the current local-file databases.
- [ ] Check desktop and narrow mobile navigation, text overflow, focus/keyboard
  behavior, slow loading and error/retry screens.
- [ ] Sender: restore session, connect, cancel selection, switch account,
  disconnect and reconnect. Verify the header, NFTs and earnings agree.
- [ ] Create a campaign with a fractional allocation totaling exactly 100%;
  verify recipient NFTs, treasury distinction and cleared local draft.
- [ ] Reject a deposit, then complete one. Verify exact amount, FINAL receipts,
  updated campaign total and claimable balances; double clicks submit once.
- [ ] A earns revenue, transfers a right to B, then receives another deposit.
  Verify current/transferred-right lists, A's retained revenue and B's future
  revenue. Record exact before/after values without converting yocto to floats.
- [ ] Complete claims for A and B through all callbacks. Verify claimed totals,
  remaining claimable amounts and transaction links after a reload.
- [ ] Gate: B can open the holder brief; former owner A cannot unless A has
  another qualifying NFT or the separate creator role. Test old saved session,
  account switch and revoked/changed key behavior.
- [ ] Verify ownership events and deposits/claims in shared activity from a
  second browser; document missing historical coverage rather than filling gaps.
- [ ] Leave a campaign open across start/end boundaries, refocus the tab and
  confirm status/deposit eligibility. NEAR block time remains authoritative.
- [ ] Test reload/redirect during signing and recover an uncertain transaction
  from its real hash; no automatic resend or duplicate financial action.
- [ ] Restart the deployed app process; confirm shared history and workspace
  persistence without exposing a brief to an unauthorized session.

## Remaining batches

Batch 2 scope (results linked above):

1. Triage/fix the lint baseline with appropriate rules for Node test scripts and
   behavior-preserving application fixes; do not globally disable React checks.
2. Execute the browser QA checklist where the available environment permits,
   recording completed cases and identifying those requiring real Sender/two
   wallet access. Automated fixtures do not check these boxes.

Then:

1. Resolve track/bounty fit against the official selected submission requirements;
   perform browser/two-wallet QA and record evidence. Do not quietly add a custody
   redesign while polishing the frontend.
2. Write the Zinc README/security explanation; prepare a reproducible judge demo
   with honest history and hosting limitations.
3. Finish screenshots/video and submission checks against confirmed rules.

Local QA passing is a checkpoint, not a claim of submission readiness or a
probability of winning.
