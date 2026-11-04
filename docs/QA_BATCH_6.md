# QA batch 6: isolated browser refresh regression and finalized state check

Date: 2026-11-03. No application or contract code changed in this batch.
No contract deployment, GitHub push or wallet signing was performed.

## 1. Real React DOM regression

Added `scripts/serve-nft-refresh-qa.mjs`, a loopback-only fixture on port 3102.
It transpiles the actual `MyNfts`, revenue-right card, earnings preview,
`useReadRefresh` and `ReadCacheSync` sources, and loads the installed production
React/React DOM packages. Wallet, transaction and contract dependencies are
replaced with explicitly isolated fixtures. No wallet SDK or RPC client is
loaded; signing throws and CSP restricts connections to the local fixture.
The synthetic campaign is visibly labelled ISOLATED QA CAMPAIGN.

Opened in Chrome and observed PASS in the rendered page and local result file
`data/nft-refresh-browser-results.json`. All ten checks passed:

- Receiver draft entered in the real DOM.
- Transfer review opened without signing.
- Same input element and open details survived a pending refresh.
- Receiver/review survived a successful refresh.
- Actual focus listener preserved the DOM draft and review.
- Failed refresh preserved the draft while blocking confirmation.
- Retry recovered the same draft.
- Lost ownership removed transfer controls.
- Account switch cleared the prior account's draft/review.
- No wallet calls or transactions occurred.

Application source SHA-256:
`26550f2e56c1f0631e6571497b02ad0ce38f9f94b87d8a08ebeb66d52d8fa525`.
Result captured at `2026-11-03T21:19:24.307Z`.

This proves component state preservation under real React DOM reconciliation,
including the focus invalidation path. It does not simulate an actual wallet
popup, validate wallet rejection, or certify production styling, RPC behavior,
full reload persistence or every release checklist item.

Run with `node scripts/serve-nft-refresh-qa.mjs`, then open
`http://127.0.0.1:3102/`. No keys, wallet connection or signature are needed.

## 2. Latest finalized on-chain state

Read-only baseline at finalized block **276102825**, hash
`CBNHhEREqpQmpqWPzs1a9d8pRU5yyxMwwE1gyqDFgRdX`, confirmed campaign #7:

- `campaign:7:right:0` is currently owned by wallet A,
  `77d96ac24fa9038a4be43b70f51a9bb52dda3bc074137fddb16ce5cf459dd92b`.
- Deposits remain **0.02 NEAR**.
- A claimed **0.006 NEAR**; B claimed **0.014 NEAR**.
- Both accounts have **0 NEAR** remaining claimable for campaign #7.

The prior browser receipt showed the later user-signed B-to-A transaction
`7N6QMjbxDLEnYZM2Phgk3N6W4utfzBfZ7v5hv2EFzJpB`. Its receipt tree was not
independently re-fetched in this batch. Current ownership and balances above
were independently read from finalized contract state. This supersedes earlier
B-ownership snapshots without invalidating the historical/future revenue test.
Evidence: `data/wallet-acceptance-276102825-1793740785077.json` (local, gitignored).

The focused `check-nft-refresh.cjs` regression passed again, as did
`git diff --check`. The fixture also syntax-checks its generated bundle before
serving it. The standalone script ESLint command did not finish after several
minutes without output and was interrupted; no lint pass is claimed for it.
The prior full application lint, production build and 23 regression scripts
passed in batch 4. This batch adds only a standalone QA script and documentation;
no new application build is claimed for this batch.
