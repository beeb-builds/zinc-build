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
- A full navigation to the workspace required reconnecting Nightly. The user
  approved reconnection and signed the hosted-domain workspace message. A then
  received **Current-holder access** to campaign #7. Recheck access succeeded
  without another signature; the creator has not published a brief yet.
- After the user connected B, A's authenticated workspace view cleared. B's
  eligibility preview showed creator/treasury status and zero owned campaign
  rights, without inheriting A's signed holder session. B's dashboard showed
  zero claimable, **0.014 NEAR claimed**, **zero owned NFTs** and **one related
  campaign**. My NFTs showed its current-ownership empty state and explicitly
  limited transferred-right history coverage.
- B's campaign #7 deposit form rejected zero and disabled review. A 0.01 NEAR
  review showed B as payer, campaign #7 and the Zinc contract as recipient.
  The review was exited and the amount cleared without opening wallet payment
  confirmation. Claim Revenue remained disabled with zero claimable; the
  claimed value was 0.014 NEAR. These checks did not submit new revenue actions.
- MIT and release documentation were pushed in commit
  `a05aca87c9cbeeb10fe7a4989ba62025d2f5abef`. Railway deployment
  `f2774441-501f-4e83-828e-497febf434e7` reached **SUCCESS**. Post-deploy GETs to
  `/`, `/gallery`, `/explore`, `/campaigns/7` and `/api/activity` returned HTTP 200.
- No new deposit, claim or NFT transfer was submitted during these checks.

This partial acceptance result does not certify automatic wallet restoration,
wallet rejection/recovery or a new complete financial scenario. MIT was selected
by the owner and added to the repository.

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

## Live deposits and claim retest: November 5 (WAT)

These are new user-approved transactions after the non-financial checks above.
They reuse campaign #7, which already had 0.02 NEAR deposited and earlier claims.

| Action | Verified public transaction | Result |
| --- | --- | --- |
| B deposits 0.01 NEAR | [C1KfhkhGowooiEVUS5zf551PzRrxopp29xhaCv2GeSoi](https://testnet.nearblocks.io/txns/C1KfhkhGowooiEVUS5zf551PzRrxopp29xhaCv2GeSoi) | FINAL; correct contract, method, campaign and attached amount; successful receipts |
| B deposits another 0.001 NEAR | [3JoK4LAEzYVk3ReLTHXwzNX5qeF2UiEaNifYEJuafr5V](https://testnet.nearblocks.io/txns/3JoK4LAEzYVk3ReLTHXwzNX5qeF2UiEaNifYEJuafr5V) | FINAL; same payload checks; campaign deposits reach 0.031 NEAR |
| B claims 0.0044 NEAR | [4bYhg84d9Bych4mXc5UcoDzV8wFs3m8vvcBPuYJ3XLZJ](https://testnet.nearblocks.io/txns/4bYhg84d9Bych4mXc5UcoDzV8wFs3m8vvcBPuYJ3XLZJ) | FINAL; attached deposit zero; actual native payout 0.0044 NEAR, callback true; six receipt outcomes verified |

The claim initially returned Nightly's generic `Request failed` without a hash.
The user checked wallet activity and reported no claim entry. Finalized balances
were unchanged. With explicit approval, only the unverified local reminder was
removed, and one fresh claim was approved manually. That claim succeeded. The
underlying cause of the first wallet error was not established; no source patch
was made on the basis of that error alone.

Finalized block **276265490** (`FgriT1rgKxHJvJzJRDkRqD9RxvHCHgn1JoSBwQGu6imk`)
confirmed campaign #7 deposits **0.031 NEAR**, B claimable **zero**, B claimed
**0.0184 NEAR**. A still owned `campaign:7:right:0`, with **0.0066 NEAR claimable**
and **0.006 NEAR previously claimed** in this campaign. The UI showed the same
values, a verified payout receipt and a disabled zero-balance claim button.

Local, gitignored proof files: `data/live-deposit-proof-2026-11-05.json`,
`data/live-b-claim-proof-2026-11-05.json` and
`data/wallet-acceptance-276265490-1793836415530.json`.

The user subsequently transferred `campaign:7:right:0` from A to B:
[4UEiG63GE7iXGWLYbn6crddvM56zDmo4mhVzFQGgUiUw](https://testnet.nearblocks.io/txns/4UEiG63GE7iXGWLYbn6crddvM56zDmo4mhVzFQGgUiUw).
Independent RPC verification found FINAL execution, method `nft_transfer`, the
correct token/receiver and exactly one yoctoNEAR attached, with successful
receipts. At finalized block **276277315**, B owned the right; A retained
**0.0066 NEAR claimable**, B remained at zero claimable, and deposits remained
0.031 NEAR. A's My NFTs view moved the right to Transferred Rights and displayed
the retained historical balance. Local evidence:
`data/live-transfer-proof-2026-11-05.json` and
`data/wallet-acceptance-276277315-1793843447121.json` (gitignored).

A then deposited another **0.01 NEAR** after the transfer:
[AQPdvtN7mGJEfqJihBmXa7EWagLtczSGG6C1J8yGbYfk](https://testnet.nearblocks.io/txns/AQPdvtN7mGJEfqJihBmXa7EWagLtczSGG6C1J8yGbYfk).
RPC verification confirmed the exact attached amount, campaign #7,
`deposit_revenue`, correct signer/contract and FINAL successful receipts.
At finalized block **276277702**
(`7KBkt1WabE3qtagyFGsMkP88npbbr6wMXYBaCcz7BzwF`), deposits were **0.041 NEAR**.
A's claimable stayed **0.0066 NEAR**; B's claimable rose from zero to **0.01 NEAR**.
B receives both the 60% NFT allocation and its existing 40% treasury allocation.
Thus B did not acquire A's historical 0.0066 NEAR, and A earned none of the later
deposit. Proof: `data/live-post-transfer-deposit-proof-2026-11-05.json` and
`data/wallet-acceptance-276277702-1793843676504.json` (gitignored).

A's former-owner historical claim then succeeded:
[3K2aZKyc3tHyYpQxq9eMVs3uHAektgGkTCQZVf99zBao](https://testnet.nearblocks.io/txns/3K2aZKyc3tHyYpQxq9eMVs3uHAektgGkTCQZVf99zBao).
RPC receipt verification confirmed **0.0066 NEAR** actually transferred to A,
callback **true**, FINAL execution and six receipt outcomes. At finalized block
**276278520**, A's claimable was zero and claimed was **0.0126 NEAR**; B still
owned the NFT and had **0.01 NEAR claimable**. This demonstrates that a former
holder can withdraw accrued revenue after transfer and after a later deposit.
The UI showed the verified payout and a disabled zero-balance claim button.

Before this success, Nightly returned `Not connected` while the app still showed
A's selected account. The unresolved-attempt guard blocked repeated requests.
The user reconnected A, checked wallet activity and removed the unverified local
reminder; one fresh manually approved claim then succeeded. This records an
observed wallet-session recovery, not a diagnosis or fix of the underlying
disconnect. No request was automatically resubmitted.
Proof: `data/live-a-historical-claim-proof-2026-11-05.json` and
`data/wallet-acceptance-276278520-1793844171256.json` (gitignored).

B's future-revenue claim also succeeded:
[2q6H34tz9LxpyAho8UaJezf7eXLr7qvhko7UnbNrDy6s](https://testnet.nearblocks.io/txns/2q6H34tz9LxpyAho8UaJezf7eXLr7qvhko7UnbNrDy6s).
Independent RPC verification confirmed an actual **0.01 NEAR** native payout to
B, callback **true**, FINAL execution and six receipt outcomes. The payout
includes B's new 60% NFT share plus its existing 40% treasury share.

At finalized block **276278897**
(`4TVCEfrFVp7XdAZrM2KXTkvT2aLMyhnqj9oXtVghTP7Y`):

| Campaign #7 ledger | Amount |
| --- | ---: |
| Lifetime deposited | 0.041 NEAR |
| A lifetime claimed | 0.0126 NEAR |
| B lifetime claimed | 0.0284 NEAR |
| A claimable | 0 NEAR |
| B claimable | 0 NEAR |
| Current NFT owner | B |

BigInt reconciliation confirmed the two claimed totals sum exactly to campaign
deposits. These are campaign #7 totals, not all-campaign balances or wallet net
balance changes after gas. Earlier campaign claims are included in lifetime
totals. New deposits in this retest were 0.021 NEAR, matched by new payouts of
0.0044 + 0.0066 + 0.01 NEAR.

**Financial retest result: passed** for explicit deposits, a one-yocto NFT
transfer, historical/future entitlement separation, the former-owner payout,
the current-owner/treasury payout, completed callbacks and exact reconciliation.
Wallet-session failures and recovery described above remain material limits;
this does not certify unattended signing, every browser or physical phones.
No contract changes or contract deployment were needed.
Final local proofs: `data/live-b-future-claim-proof-2026-11-05.json` and
`data/wallet-acceptance-276278897-1793844396377.json` (gitignored).

## Remaining acceptance work

1. Investigate Nightly's observed session disconnects and finish explicit
   rejection coverage. Manual recovery and the full financial retest passed;
   automatic wallet restoration and rejection behavior are not certified by it.
2. Retest a physical phone. Nightly/Sender mobile connectivity is not certified
   by viewport tests or by desktop wallet success.
3. Demonstrate revocation with a non-sensitive published brief already rendered
   in a former holder's tab. The original live run used the empty brief state.
4. Confirm hosting remains funded and available through judging; maintain SQLite
   backups. The persistent volume is not itself a backup.
5. Confirm development provenance, then publish a human-reviewed demo and complete
   the [submission checklist](SUBMISSION_CHECKLIST.md). The owner selected MIT;
   [LICENSE](../LICENSE) now records it.

The initial read-only checkpoint submitted no financial transactions. The later
live retest above records its user-approved deposits, transfer and claims separately. No
contract deployment or hackathon submission was performed. Existing activity is
a partial verified record, not a complete indexer. Zinc uses central contract
custody, not per-NFT accounts.
