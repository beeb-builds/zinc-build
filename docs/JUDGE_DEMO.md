# Zinc judge demo guide

## Narrative

Zinc turns contributor revenue agreements into transferable NFTs. Current holders
earn future deposits; former holders retain revenue already earned. Treasury
stays account-based. Funds are held in Zinc's central contract.

## Prepare

Follow the [README](../README.md). The public tour needs no wallet. A fresh
financial demo needs two distinct Testnet accounts you control, A and B, and
testnet NEAR for deposits and gas. Confirm Settings shows Testnet and
`zinc-builder-2026.testnet`. Wallet approvals stay manual.

Use a **fresh campaign N** for each walkthrough. Campaign #7 is recorded evidence,
not a zero-balance fixture. Its dates may have ended when judges review it. Give
new campaigns an active UTC range with enough time for the demo.

## Public tour: do X, see Y

| Action | Expected result |
| --- | --- |
| Open `/` | Live totals and deposits by campaign; disconnected wallet earnings state. |
| Open `/campaigns/7` | Zinc Acceptance Test, 60% Artist right, 40% treasury, original contributor versus current owner. Recorded deposits: 0.02 NEAR. |
| Open `/rights/campaign%3A7%3Aright%3A0` | Actual NFT, current owner and available ownership evidence, with coverage limits. |
| Open `/transactions` and select campaign #7 | Available creation/deposit/transfer/claim evidence and explorer links. A fresh local database may need imports by hash/signer. |
| Open `/workspace/7` disconnected | Access explanation and wallet connection state, without private brief content. |

Missing records in a partial feed do not mean no transaction occurred. Use the
public links below or the earlier-transaction verification flow.

## Fresh two-wallet walkthrough

Use exactly the two deposits below. Make no claims before steps 8–9. If other
transactions occur, compare the actual ledger rather than presenting these
expectations as observed results.

| Step | Do X | See Y |
| --- | --- | --- |
| 1 | As B, create N: one contributor A, Artist 60%; treasury B 40%; active dates. Review and approve once. | One `campaign:N:right:0` NFT assigned to A. Treasury allocation receives no NFT. |
| 2 | Deposit 0.01 NEAR into N; wait for confirmation. | Deposited 0.01; A claimable 0.006; B claimable 0.004. |
| 3 | Connect A; open My NFTs and the right detail. | A owns the 60% right. Original contributor and current owner are explicit. |
| 4 | As A, open `/workspace/N`, sign the message, keep the authenticated tab open. | Current-holder access; honest empty state if no brief was published. A is not creator. |
| 5 | In My NFTs, enter B, review exact token/from/to/share, approve transfer with exactly one yoctoNEAR plus gas. | B owns NFT. A sees Transferred Rights and retains 0.006 historical claimable. B still has only 0.004 treasury claimable. |
| 6 | Return to A's original workspace tab; recheck the existing session without signing again. | Holder access denied. Historical earnings remain accessible separately. |
| 7 | Deposit another 0.01 NEAR; refresh both earnings. | Deposited 0.02. A stays 0.006; B rises to 0.014 (0.008 treasury plus 0.006 later NFT revenue). |
| 8 | As A, claim 0.006; wait for final payout/callback success. | A claimed 0.006, claimable zero, despite no longer holding NFT. |
| 9 | As B, claim 0.014; wait for final payout/callback success. | B claimed 0.014, claimable zero; B still owns NFT. Combined claims equal 0.02. |

B is creator and treasury. B's workspace access alone cannot prove holder
authorization: creator editorial access persists. A's loss of access is the
meaningful revocation check. Previously copied content cannot be revoked.

For a published-brief demonstration, B can publish a short non-sensitive brief
before A first authenticates. The recorded run used the empty state; removal of
previously rendered private content remains additional QA.

Claims cost gas. Compare contract ledgers and successful payout receipts, not
net wallet balance changes. Never repeat an uncertain payment because a page is
slow; inspect transaction recovery, wallet activity and final receipts first.

## Recorded Testnet proof: November 3, 2026

- A: `77d96ac24fa9038a4be43b70f51a9bb52dda3bc074137fddb16ce5cf459dd92b`
- B: `d500c193b9052dd191dc69793180e5dec0cb3ee2bec9adaec646753487646671`
- Campaign **7**, NFT **`campaign:7:right:0`**.

| Action | Public transaction |
| --- | --- |
| Create (B) | [Creation](https://testnet.nearblocks.io/txns/Csg6BrfcqkKPyZQCjoLFk1CZjDkPeo6Nzbo93uEniF2P) |
| First 0.01 deposit (B) | [First deposit](https://testnet.nearblocks.io/txns/8TVunKevYvVvxYg8EYdH4Bget6TqhXBsjJorU1G6pLcM) |
| Transfer A to B | [NFT transfer](https://testnet.nearblocks.io/txns/AdYEc7L7C1mF58j8aQpTmoFiG2MR2yXqE33ta366myfJ) |
| Second 0.01 deposit | [Second deposit](https://testnet.nearblocks.io/txns/9fYK8Vn4amyvqSQj1adfGWW3RKGTFYokFMRyDwP4zzHz) |
| A historical claim | [A payout](https://testnet.nearblocks.io/txns/3mvdKcNykR3vPNdFifotkocz1fVKFbDbjbZKPKjk4CKu) |
| B later NFT + treasury claim | [B payout](https://testnet.nearblocks.io/txns/E7waKZfxTtzmwbQegVkuAxHz3xVtEXREZpy6tT69nTV1) |

At finalized block **276052836**, A claimed 0.006 NEAR, B claimed 0.014 NEAR,
both claimable zero, deposits 0.02 NEAR, and B owned the NFT. Both claim callbacks
returned true with FINAL execution. See the [acceptance report](TWO_WALLET_ACCEPTANCE.md).
Local generated JSON is gitignored; public hashes remain reviewable.

**Later ownership change:** the user signed a return transfer during follow-up
QA. At finalized block **276057974**, A owned the NFT again. Claimed totals stayed
0.006 / 0.014, both claimable zero, deposits 0.02. Present the earlier sequence
as recorded proof, not a claim that B will always be the live owner.
A further user-confirmed transfer put ownership back with B at block
**276058888**, with the same claimed totals, zero claimable and 0.02 deposited.
These later transfers did not repeat the deposits or claims in the core scenario.

For fresh runs, use `node scripts/read-wallet-baseline.mjs A_PUBLIC_ID B_PUBLIC_ID`
with actual public IDs between stages. It pins views to one finalized block and
records exact strings. It never signs/submits or proves account control.

## Suggested three-minute recording

1. **0:00–0:25:** Explain team revenue allocation; show a real split and NFT.
2. **0:25–1:05:** Show a confirmed deposit and A's earned amount with the actual
   transaction link. Skip repetitive unlocking footage.
3. **1:05–1:50:** Show transfer review/confirmation, B ownership, A's retained
   earnings and Transferred Rights. Explain future versus historical revenue.
4. **1:50–2:30:** Show later deposit, unchanged A entitlement, new B earnings and
   completed claims, including real amounts and receipt links.
5. **2:30–3:00:** Show former-holder workspace denial, repo, runnable instructions
   and acceptance report. Identify the network as Testnet.

Record a fresh sequence or label recorded evidence. Never combine different
campaigns/pending prompts into a fabricated success. Native support is a campaign
deposit, not an NFT sale.

## Submission preparation still required

- Review files/history for keys and personal data before publishing. No push or
  publication is performed by this guide.
- Select a license; document baseline/submission refs, earlier work, AI/library
  use, team and submission details.
- Use persistent HTTPS hosting if available; otherwise provide reproducible
  local setup and video. Test from a clean checkout/database.
- Recheck [official rules](https://nearhackathon.com/HACKATHON.md). As checked
  November 3, integrations are optional (Q-011), Testnet is eligible (Q-010), and
  starter prompts are examples. Published deadline: November 14, 2026, 23:59 UTC.
- The human publishes the demo post and confirms the exact submission payload.
  This guide does not submit anything or promise a prize.
