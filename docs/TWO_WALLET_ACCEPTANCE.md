# Two-wallet UI acceptance test

Status: **core live scenario passed: creation, deposits, transfer, historical/future accounting, access revocation and both claims verified**. Additional reload/coverage checks below remain open. Wallet A was supplied by the user:

`77d96ac24fa9038a4be43b70f51a9bb52dda3bc074137fddb16ce5cf459dd92b`

Wallet B was replaced by the user on 2026-11-03 after a wallet connection issue:

`d500c193b9052dd191dc69793180e5dec0cb3ee2bec9adaec646753487646671`

Both public IDs are now recorded. No keys or recovery phrases are needed.
The signed two-account execution checklist remains pending.

## Recorded starting evidence

Current A/replacement-B baseline: `data/wallet-acceptance-276047092-1793707839623.json`,
finalized block **276047092**, hash
`Fi7nfNztTra1Jneq487sJMaiuu537xetp1DABEUWW6Bw`. Neither account owned a
contributor right across the seven campaigns; both had zero claimable revenue.
A's campaign #6 claimed value remained 0.012 NEAR; replacement B had zero claimed
everywhere. The earlier B below is superseded and must not be used as recipient
or treasury for the proposed scenario.

Earlier snapshot using superseded B (`71f8f919…551e8294`) on 2026-11-03:
`data/wallet-acceptance-276043533-1793705765815.json`, finalized block
**276043533**, hash `77xApp6nKF9Qup36Qr6dGGnoTE55XmnK1yTMhZidtYyR`.
Across all seven campaigns, neither account currently owned contributor rights
and both had zero claimable revenue. A had 0.012 NEAR already claimed in campaign
#6; B's claimed amounts were zero everywhere. The dedicated test campaign has
not been created, and no deposit, transfer or claim was submitted for this test.

The read-only snapshot in `data/wallet-acceptance-baseline.json` was taken at
finalized Testnet block **275926400**, hash
`GiS9QJGR6zdNZzz8TedsdfoiBmbB6xWDe2s33jdD6MYf`.

At that block, wallet A owned no contributor rights across the seven campaigns.
Its claimable amount was zero in every campaign. Campaign #6 recorded
`12000000000000000000000` yoctoNEAR (**0.012 NEAR**) already claimed by A;
all its other recorded claimed values were zero.

This is a point-in-time observation, not a promise that balances remain the same.
Do not interpret "no currently owned rights" as deletion of historical earnings.
The current portfolio does not provide an A-owned right to transfer directly.

## Read-only snapshots

From the project root:

```powershell
node scripts/read-wallet-baseline.mjs "77d96ac24fa9038a4be43b70f51a9bb52dda3bc074137fddb16ce5cf459dd92b" "d500c193b9052dd191dc69793180e5dec0cb3ee2bec9adaec646753487646671"
```

The helper reads the app's Testnet contract/RPC config,
pins all ownership and balance queries to one finalized block, and saves a new
`data/wallet-acceptance-{height}-{time}.json` file. Preserve the file for each stage.
It never requests a wallet, reads credentials or submits transactions. Both zero
and large amounts remain decimal strings. A failed/incomplete read produces no
new successful evidence file.

The snapshot reports Zinc rights and revenue accounting, not wallet gas balances
or whether a public ID's private key is controlled by the tester.

## Proposed clean scenario — expected values, not observed results

Use a dedicated, zero-revenue Testnet campaign rather than moving an existing
valuable right. Keep all previous campaign state unchanged.

- Creator: wallet B.
- Exactly one contributor: wallet A, role `Artist`, share **60%**.
- Treasury: wallet B, **40%** (account-based).
- Dates: already Active when testing, with sufficient time before expiry.
- Record the actual new campaign ID and its token ID from the confirmed result.

This allocation means B has treasury earnings before receiving the NFT. Its
historical treasury revenue must not be mistaken for A's historical NFT revenue.

| Stage | A claimable | B claimable | Ownership |
| --- | --- | --- | --- |
| Fresh campaign | 0 | 0 | A owns the contributor NFT |
| First deposit: 0.01 NEAR | 0.006 NEAR | 0.004 NEAR | A owns the NFT |
| Transfer A → B, no intervening deposits | 0.006 NEAR | 0.004 NEAR | B owns the NFT; A keeps historical revenue |
| Second deposit: 0.01 NEAR | 0.006 NEAR | 0.014 NEAR | B earns the later 0.006 NFT share plus both 0.004 treasury shares |
| Both complete their claims | 0 | 0 | A claimed 0.006; B claimed 0.014; lifetime campaign deposits 0.02 NEAR |

These expected values require **no claims before the final stage**, exactly the
two listed deposits, one transfer, and no additional rights/treasury allocations.
If other transactions occur, calculate from the recorded ledger instead of
forcing the results to match the table. Do not compare net wallet balance change
directly with the payout amount: transaction fees also affect wallet balances.

## Execution checklist

### Observed campaign #7 results (2026-11-03)

- Creation confirmed in the browser; transaction
  [Csg6BrfcqkKPyZQCjoLFk1CZjDkPeo6Nzbo93uEniF2P](https://testnet.nearblocks.io/txns/Csg6BrfcqkKPyZQCjoLFk1CZjDkPeo6Nzbo93uEniF2P).
  Finalized block 276047790 snapshot:
  `data/wallet-acceptance-276047790-1793708258532.json`.
  Campaign #7 was named `Zinc Acceptance Test`, total deposited zero,
  `campaign:7:right:0` owned by A, Artist, 6000 bps; treasury B 4000 bps.
  Both accounts had zero claimed and claimable in this campaign.
- User completed the first deposit while the form was being inspected.
  Browser displayed successful 0.01 NEAR paid by B. Transaction
  [8TVunKevYvVvxYg8EYdH4Bget6TqhXBsjJorU1G6pLcM](https://testnet.nearblocks.io/txns/8TVunKevYvVvxYg8EYdH4Bget6TqhXBsjJorU1G6pLcM).
  Finalized block 276047910, hash
  `CPsiUgKvSRaXdVN3BLmDD97nc83u9sHvdXwsdNQ6vjLQ`, snapshot
  `data/wallet-acceptance-276047910-1793708329644.json`:
  deposited `10000000000000000000000`, A claimable `6000000000000000000000`,
  B claimable `4000000000000000000000`, both claimed zero. A still owned the NFT.
  This matches the expected first-deposit split exactly. Transfer, second deposit,
  claims and workspace authentication/revocation are still pending.
- A was connected in the browser. Dashboard displayed 0.006 NEAR claimable;
  My NFTs displayed one current right (`campaign:7:right:0`, Artist 60%, owned
  by A) and two older transferred rights (#5 and #6). Transfer receiver input
  was populated with replacement B, but no transfer was submitted.
  Opened `/workspace/7` before transfer: the public eligibility preview recognized
  A as a current holder and original contributor, and offered message signing.
  Authentication is pending user signature. The workspace initially loaded
  without CSS: port 3000 returned 404 for a stylesheet present in the current
  build. A fresh port-3101 server served it correctly. After explicit user
  authorization, the verified Zinc `next start` process on port 3000 was
  restarted. `/workspace/7` and its 77,576-byte CSS asset both returned HTTP 200
  (stylesheet content type `text/css`). The temporary port-3101 server was stopped.
  No application code changed. Browser refresh/visual confirmation is pending.
- After refresh, the user signed the workspace message. Browser verification
  showed A connected, restored navy/coral styling, `Current-holder access` and
  `The campaign creator has not published a private brief yet.` The authenticated
  workspace tab was kept open. This verifies successful current-holder message
  authentication, not private content publication or post-transfer revocation.
  In a separate My NFTs tab the exact transfer was prepared for review:
  `campaign:7:right:0`, Artist 60%, A to replacement B, exactly one yoctoNEAR plus
  gas. The review showed A claimable 0.006 NEAR and claimed zero. Browser was left
  at **Confirm in wallet**, without clicking that action.
- User completed the transfer. Browser receipt linked
  [AdYEc7L7C1mF58j8aQpTmoFiG2MR2yXqE33ta366myfJ](https://testnet.nearblocks.io/txns/AdYEc7L7C1mF58j8aQpTmoFiG2MR2yXqE33ta366myfJ)
  and displayed exactly one yoctoNEAR attached. Finalized block **276050087**,
  hash `BNAFuiNAizHVFimnqQSHKPYDF8R4kCbXHas9coEYnVDj`, snapshot
  `data/wallet-acceptance-276050087-1793709613028.json`: B owns the NFT,
  deposited 0.01 NEAR, A claimable 0.006, B claimable 0.004, both claimed zero.
  My NFTs showed A current rights zero, previous rights three, campaign #7 under
  Transferred Rights with B as current owner and 0.006 NEAR historical claimable.
- Returned to the original `localhost:3000/workspace/7` authenticated tab while
  A stayed connected. Current-holder access was removed. Clicking **Recheck
  existing session** completed with denial: `Access requires a currently owned
  campaign NFT. Former ownership and treasury shares do not grant access.`
  No new signature was requested. There was no published brief to test removal
  of previously rendered private content; this verifies access-check denial.
- User completed the second deposit. Finalized block **276050732**, hash
  `Gc1EjRH8mnjfa7eFBRzLi9MEfmPZamqYdxN74KMRhRtY`, snapshot
  `data/wallet-acceptance-276050732-1793709982448.json`: campaign #7 deposited
  `20000000000000000000000` (0.02 NEAR); A claimable remained
  `6000000000000000000000` (0.006 NEAR); B claimable became
  `14000000000000000000000` (0.014 NEAR). Both claimed zero; B still owns the NFT.
  This exactly matches historical revenue retained by A and future NFT revenue
  earned by B. B's amount includes 0.008 treasury plus 0.006 post-transfer NFT
  revenue. Completed payout/callback evidence is still pending.
- A completed the historical claim. Finalized snapshot at block **276051145**,
  hash `552pqCcuJXPzEkfaCdpDyxjfkvRTDjs471jdV5mMvnFx`, file
  `data/wallet-acceptance-276051145-1793710228640.json`: A claimable zero,
  claimed `6000000000000000000000`; B claimable `14000000000000000000000`,
  claimed zero. NFT remains owned by B; campaign deposits remain 0.02 NEAR.
  Browser linked claim transaction
  [3mvdKcNykR3vPNdFifotkocz1fVKFbDbjbZKPKjk4CKu](https://testnet.nearblocks.io/txns/3mvdKcNykR3vPNdFifotkocz1fVKFbDbjbZKPKjk4CKu).
  Read-only `tx` RPC evidence in `data/acceptance-campaign-7-claim-A.json`:
  signer A, receiver Zinc, `claim_revenue`, args campaign_id 7, zero attached
  deposit, 100 Tgas, final execution FINAL, success value `true`, all returned
  receipt outcomes successful. Callback receipt
  `49DsFoyWzTR2ritnKnvuBamBHYvoE4wa5hNZSmCV1yof` executed on Zinc and returned
  true. Thus a mere optimistic claimed counter is not the only success evidence.
  This `tx` response contains receipt outcomes, not full transfer action bodies.
  Second-deposit transaction link observed in browser:
  [9fYK8Vn4amyvqSQj1adfGWW3RKGTFYokFMRyDwP4zzHz](https://testnet.nearblocks.io/txns/9fYK8Vn4amyvqSQj1adfGWW3RKGTFYokFMRyDwP4zzHz).
  B's claim is the remaining payout step.
- B subsequently completed its claim. Finalized block **276052836**, hash
  `3xP7dVuA4TYYfNkpzZgi1uQEbsz1hCzyMqgA4awKoTUt`, snapshot
  `data/wallet-acceptance-276052836-1793711177429.json`: A claimed 0.006 NEAR,
  B claimed 0.014 NEAR, both claimable zero; deposits 0.02 NEAR; B owns the NFT.
  Browser and RPC transaction evidence:
  [E7waKZfxTtzmwbQegVkuAxHz3xVtEXREZpy6tT69nTV1](https://testnet.nearblocks.io/txns/E7waKZfxTtzmwbQegVkuAxHz3xVtEXREZpy6tT69nTV1).
  `data/acceptance-campaign-7-claim-B.json` records signer B, receiver Zinc,
  `claim_revenue` for campaign 7, zero attached deposit, 100 Tgas, FINAL execution,
  all returned receipt outcomes successful and callback
  `EoBE2RFkm4cfHDDoUGZNE7fuU8Nm4PDb3coaJVxWVKXz` returning true.
  Browser also displayed the 0.014 NEAR payout. Claimed totals exactly exhaust
  the 0.02 NEAR deposits in this scenario; no further deposits occurred in the
  recorded snapshots. This does not measure net wallet balance after gas.

### Later return transfer during follow-up QA

After the core acceptance scenario, the user signed a B-to-A transfer during a
follow-up draft-preservation check that was intended to be read-only. It was not
cancelled. Browser receipt linked
[6dqmR8XJVuvaUgPWp7YRk7EyroUqhUXdyMaMja3Lhiz8](https://testnet.nearblocks.io/txns/6dqmR8XJVuvaUgPWp7YRk7EyroUqhUXdyMaMja3Lhiz8).
Read-only finalized snapshot `data/wallet-acceptance-276057974-1793714206818.json`,
block **276057974**, hash `9yEr57JKLvs4zuDKNkMKpr4KxwHWbjtjbRFAydBuXQUa`:
A owns `campaign:7:right:0` again; A claimed 0.006 NEAR, B claimed 0.014 NEAR,
both claimable zero, campaign deposits still 0.02 NEAR. This is an additional
ownership change, not a reversal of the earlier claimed payments. The original
core scenario remains evidenced at its earlier finalized blocks. Current ownership
must be read live; do not present B's earlier ownership as permanent.

The user subsequently confirmed another A-to-B transfer. Finalized snapshot
`data/wallet-acceptance-276058888-1793714741106.json`, block **276058888**, hash
`EX458BjDHg5GreRNz8pYSacMTWcpAwBS2wcMjPNqYUXv`, again shows B as owner.
A claimed 0.006 NEAR and B claimed 0.014 NEAR; both claimable zero; deposited
total remains 0.02 NEAR. This check establishes finalized ownership/ledger state;
the additional transfer's transaction hash/receipt was not captured in this step.
No further transfer is required to complete the original financial scenario.
The separate draft-only tab-switch QA remains unverified because signing a
transfer does not demonstrate that a draft survived a background refresh.

Browser preparation on 2026-11-03: Zinc at `localhost:3000` displayed replacement
B as connected. The `Zinc Acceptance Test` draft was filled and opened in final
review: November 3–10, 2026 UTC, one Artist right to A at 60%, treasury replacement
B at 40%, total 100%. Recipient and treasury were visually checked in review.
At that preparation step the browser was left at **Create Campaign on NEAR**;
the user subsequently completed creation as recorded above.

- [ ] User confirms the two distinct wallet accounts and the scenario.
- [x] User connects B and creates the dedicated campaign through the existing UI.
- [x] Record creation transaction hash, campaign ID, token ID and finalized timestamp evidence.
- [x] User connects A. My NFTs shows the right and its current-owner account A.
- [x] A can authenticate to the holder workspace using a message signature.
- [x] Capture a finalized baseline for both accounts before deposits.
- [x] User completes the first deposit; browser reports confirmed transaction.
- [x] Capture finalized snapshot and compare the first-deposit row above.
- [x] User reviews the exact recipient and completes A → B through My NFTs;
  attached deposit is exactly one yoctoNEAR. No sale/payment is included.
- [x] Capture snapshot immediately after transfer, before another deposit.
- [x] A's My NFTs moves the right to Transferred Rights; its card identifies B.
- [x] A's historical claimable remains visible; B does not receive A's accrued
  0.006 NEAR. B's 0.004 NEAR at this point is treasury revenue.
- [x] A's saved holder session no longer authorizes protected reads. A is not
  the creator in this scenario. B retains creator editorial access, so B's access
  alone is not proof of the holder-only authorization path.
- [x] User completes the second deposit; capture and compare both balances.
- [x] User completes A's and B's claims separately; wait for successful payout
  callbacks, record hashes and compare claimed/claimable values.
- [ ] Reload both sessions and verify ownership, retained earnings and history
  labels persist. Missing indexed events must remain labeled as gaps.

No financial/signing action in this checklist is marked complete by the
read-only helper or its fixture tests. Wallet authentication and signatures stay
with the user; they are not automated by this QA batch.

Latest follow-up: [QA_BATCH_6.md](QA_BATCH_6.md) records the passing isolated
real-DOM transfer-draft refresh test. At finalized block 276102825, wallet A
owns the campaign #7 right after a later user-signed return transfer; deposits,
claimed totals and zero remaining claimable balances are unchanged. Earlier
ownership observations describe their specific blocks, not the current owner.
