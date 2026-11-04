# Wallet earnings

The earnings screen reads every campaign's `get_claimable` and `get_claimed`
for the connected account. This complete balance snapshot either succeeds in
full or displays an error. Monetary aggregation and claimable-first ordering use
BigInt; no ownership or history failure can turn an unknown balance into zero.

Ownership is a separate read. Each campaign's rights are validated against its
contributor indices, roles, shares and token IDs. Unknown ownership stays unknown,
not “transferred.” The owned-token count comes from the NFT owner listing. When
all rights and the listing load but disagree, ownership is withheld for a refresh
while complete account balances remain visible.

Verified shared mint/transfer evidence can include received-then-transferred rights
with zero earnings in the related-campaign list. This read is optional and limited
to the latest 200 matching records; missing imports can leave gaps. Positive
balances, original allocations, treasury and current rights remain independent
sources of related campaigns. “Campaigns With Earnings” counts positive claimable
or claimed balances; it does not count a zero-earning relationship as earnings.

Filters cover claimable balances, current rights, previously held rights and treasury.
Historical badges are only assigned when the relevant current ownership is known.
Amounts remain campaign/account totals; the UI does not split them into fabricated
per-token or historical-versus-current payout subtotals. Claims still happen on
the campaign page through its existing signing and callback checks.

Run `node scripts/check-wallet-earnings.cjs`. It uses mocked reads and real React
rendering, including large/single-yocto values, independent failures and ownership
races. It never signs or submits transactions.
