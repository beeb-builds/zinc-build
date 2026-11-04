# Release acceptance: November 4, with November 5 hosted recheck

Application release reviewed: `c80fd0a5c2c3890095d8f6c13cfdee1f7f4f11d6`.
Public app: <https://zinc-build-production.up.railway.app>.
This is an evidence checkpoint, not a security audit or a guarantee of readiness.

## Hosted recheck: November 5 (WAT)

- All 16 hosted route/layout checks passed: eight routes at 375 and 1440 pixels
  returned HTTP 200, loaded Zinc styling and had no horizontal overflow.
- In the user's Chrome, connected wallet A's personal dashboard showed zero
  claimable, 0.018 NEAR claimed, one owned NFT and seven related campaigns.
- My NFTs showed `campaign:7:right:0`, Artist, 60%, owned by A. Transferred
  rights #5/#6 remained visible, with campaign #6's historical 0.012 NEAR claimed.
- A new finalized read at block **276260646**, hash
  `Grm48varDeZwj3GLGksjLnsHU6wkZnEbkkdyPUucrRNM`, confirmed the same balances
  and campaign #7 ownership. Capture: `data/wallet-acceptance-276260646-1793833446071.json`
  (gitignored). UTC capture falls on November 4; the local test date is November 5.
- A full navigation to the workspace required reconnecting Nightly. Fresh
  connection approval and signed workspace access are still pending; no new
  financial action was approved or submitted by this check.

This partial acceptance result does not certify reload persistence or the full
signed flow. MIT was selected by the owner and added to the repository.

## Evidence and coverage

| Check | Result | Coverage limit |
| --- | --- | --- |
| Contract unit tests, rerun November 4 | `cargo test --offline`: 69 passed, zero failed | near-sdk test contexts; not new public-network transactions |
| Frontend regressions, rerun November 4 | All 29 `scripts/check-*.cjs` passed | Isolated fixtures, including signatures and receipts; not real browser-wallet approvals |
| Product-discovery production build and lint | Passed for the reviewed application release | See [product discovery report](PRODUCT_DISCOVERY.md) |
| Hosted public pages and personal-dashboard fixtures | Public gallery, token detail, project roster and Explore journeys; wallet switching and unrelated-wallet empty state | Wallet fixtures are isolated; public reads use real Testnet data |
| Responsive discovery pages | 15 checks: five routes at 320, 390 and 1440 pixels; no overflow/page errors | Browser viewports, not physical-phone wallet acceptance |
| Live financial scenario | Creation, two deposits, NFT transfer, historical/future accounting and both final payout callbacks verified November 3 | Recorded campaign #7 evidence; see [public transaction links](TWO_WALLET_ACCEPTANCE.md) |
| Hosted persistence | Activity record and one-use workspace challenge survived a Railway restart in earlier verification | Not a disaster-recovery or backup-restore test |
| NFT migration sandbox | Existing October 31 rehearsal passed migration, preservation, transfer and completed claims | Synthetic equivalent pre-NFT state; Docker rehearsal not rerun in this checkpoint |

The regression suite covers exact integer amounts, account isolation, stale reads,
rejected signing, duplicate submission, transaction recovery, ownership refresh,
workspace authorization, receipt validation and persistent SQLite stores.
See [sandbox measurements](../scripts/nft-sandbox/artifacts/REPORT.md) separately.

## Finalized state recheck

Read-only capture at **2026-11-04T16:35:51.586Z**, block **276220305**,
hash `HPQmgV9ZYSKBqFZbUBtMhssNzqTLgqUZCWEFEysXo17y`:

- Eight campaigns; exact aggregate deposits: **0.11 NEAR**.
- Campaign #7: **0.02 NEAR** deposited; `campaign:7:right:0` owned by wallet A.
- Campaign #7: A claimed **0.006 NEAR**; B claimed **0.014 NEAR**; both claimable zero.
- Across all campaigns: A claimed **0.018 NEAR**; B claimed **0.014 NEAR**.

Account IDs and the historical transfer sequence are in the
[two-wallet report](TWO_WALLET_ACCEPTANCE.md). Capture command:
`node scripts/read-wallet-baseline.mjs A_PUBLIC_ID B_PUBLIC_ID`.
It pins all reads to one finalized block and never signs. The generated snapshot
is local and gitignored. Public chain state and current ownership may change.

## Remaining acceptance work

1. Complete a fresh hosted-domain wallet walkthrough with manual approvals,
   including NEP-413 workspace signing, rejection/recovery and account switching.
   Use a fresh campaign if demonstrating the full financial sequence.
2. Retest a physical phone. Nightly/Sender mobile connectivity is not certified
   by viewport tests or by desktop wallet success.
3. Demonstrate revocation with a non-sensitive published brief already rendered
   in a former holder's tab. The original live run used the empty brief state.
4. Confirm hosting remains funded and available through judging; maintain SQLite
   backups. The persistent volume is not itself a backup.
5. Confirm development provenance, then publish a human-reviewed demo and complete
   the [submission checklist](SUBMISSION_CHECKLIST.md). The owner selected MIT;
   [LICENSE](../LICENSE) now records it.

No contract deployment, new financial transaction or hackathon submission was
performed during this checkpoint. Existing activity is a partial verified record,
not a complete indexer. Zinc uses central contract custody, not per-NFT accounts.
