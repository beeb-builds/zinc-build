# Shared transaction evidence

`/transactions`, campaign activity and token-filtered links read `/api/activity`.
The Node server stores verified public records in `data/zinc-activity.sqlite`.
Use Node 22.13 or later and a persistent writable volume. Override the path with
`ZINC_ACTIVITY_DB`. The existing `/data/` gitignore excludes the database.
As with the workspace database, separate ephemeral server instances do not share
this file. Use shared durable storage/a database service before hosting on that model.

New successful wallet actions submit only a transaction hash and signer in the
background. The server independently looks up finalized execution and receipts
through the configured NEAR RPC. Client-supplied labels, amounts, token IDs and
owners are never used to create shared evidence. Failure to save history never
changes the outcome of a successful payment. The wallet's browser confirmation
remains a fallback and is labelled separately.

Earlier single-call transactions can be imported through “Verify an earlier
transaction.” Copy the hash and original signer from wallet activity or the
explorer. This is read-only and does not request a wallet signature. RPC pruning
may make older transactions unavailable; the API reports that limitation.
There is no automatic historical indexer or claim of complete coverage. Existing
browser confirmations are not automatically backfilled; import their hashes to
share them. The latest 200 matching shared rows are returned, with campaign state
records and local confirmations also available to the feed.

Supported evidence:

- Campaign creation: decoded successful method result, supplemented by live state.
- Deposits: the successful function call's exact attached yoctoNEAR.
- Claims: a successful final `true` callback; amount shown only if the completed
  contract-to-signer transfer receipt is available. System gas refunds are excluded.
- NFT mints/transfers: NEP-171 logs executed by Zinc, with distinct event IDs for
  every token. These are events, not reconstructed ownership snapshots. Multiple
  transfers/reverts inside a transaction remain distinct events. Timestamps use
  the transaction execution block; events within it do not have separate times.

Claim amounts are campaign/account payouts. They cannot be truthfully attributed
to a particular NFT using current aggregate accounting. NFT-filtered history
therefore includes NFT events, not invented per-token earnings.

Each `/rights/[tokenId]` page now embeds ownership history from the same source.
It requests only that campaign/token's records, without rereading every campaign.
Live original/current owner labels stay separate from the event list, including
when history is empty or unavailable. The list preserves multiple events from
one transaction and transfers back to a previous owner; it does not infer owner
tenure, first-transfer dates, or missing events. Connected accounts are highlighted
when they appear as a sender/recipient, and can jump to their campaign earnings.
`node scripts/check-right-history.cjs` checks filtering and rendered UI states.

`/nfts` also queries shared mint/transfer evidence involving the connected account
(`owner` filter, applied before the 200-row limit). This recognizes received NFTs
that were subsequently transferred onward after a reload or in another browser.
The event must name the wallet as an owner/recipient; being a transaction signer
or approved operator alone is insufficient. Live contract rights still determine
whether each right is currently owned or belongs in Transferred Rights. Original
contributor relationships and page-session observations remain fallback sources.
If shared history is unavailable or incomplete, the UI labels that limitation.
Historical balances are still read once per campaign/account, never per NFT.

Successful transfers now show a receipt containing the transaction recipient,
hash, token and links to current ownership/history and retained campaign earnings.
The receipt names the transaction recipient rather than asserting that recipient
is still the NFT's current owner; the right may be transferred again later.

Claims also show a confirmed payout receipt on the campaign/NFT detail page.
`successfulClaimAmount` is shared by the browser and server history verifier. It
requires a successful payout callback, matches successful native-transfer receipt
IDs and the claimant account, excludes system gas refunds, and counts each receipt
only once using BigInt arithmetic. Wallet results without receipt action bodies
still confirm the callback, but do not supply an amount. The UI then looks for the
matching verified claim in shared history and can retry that read independently.
Missing history or balance refresh failures never turn a confirmed payout into a
failed claim or substitute the pre-signing claimable balance as the paid amount.
Run `node scripts/check-claim-receipt.cjs` for the receipt evidence/UI checks.

Imports are idempotent, require same-origin browser requests, cap body size at
2 KB, allow two active verifications per process and have a shared SQLite budget
of 30 new lookups per minute. These are prototype limits; use deployment-level
rate limits for an internet-facing service. Reads return at most 200 rows. No
private workspace data is stored in this public database.

Run `node scripts/check-shared-activity.cjs` for receipt fixtures and real in-memory
SQLite checks. These tests neither sign nor send chain transactions.
