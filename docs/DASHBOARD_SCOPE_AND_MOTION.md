# Dashboard scope and motion

The personal dashboard at `/` is separate from shared platform data at `/explore`.

- **Your wallet:** total claimable and claimed revenue, currently owned revenue-right NFTs, and related campaigns. Relationships include campaign creation, original contributor allocation, current NFT ownership, treasury shares, or nonzero historical account earnings. Being a campaign creator does not itself grant revenue.
- **Platform overview (`/explore`):** deposited revenue across all campaigns, active/total campaigns, NFT supply, campaign revenue chart, allocation example, and recent public campaigns. These values intentionally stay the same when switching wallets and are not shown on the personal home page.

Personal values use the existing contract read helpers and exact BigInt arithmetic. Current ownership comes from paginated `nft_tokens_for_owner`. Historical balances come from `get_claimable` and `get_claimed` for every campaign, so transferring an NFT does not hide previously earned revenue. Unavailable reads are labeled unavailable rather than zero. Account and campaign-snapshot checks prevent old-wallet values from appearing during a switch, refresh, or late response.

Scroll reveals use IntersectionObserver and CSS transforms/opacity, with no per-frame React updates or RPC polling. A browser-native reading-progress line is enabled where CSS scroll timelines are supported. Below-fold sections reveal once; above-fold content remains visible immediately. Nested panels avoid stacked reveal transforms. Focused content is revealed immediately. Reduced-motion preferences disable the reveals/progress effects, including when changed while the page is open. Without JavaScript or IntersectionObserver, content remains visible.

Verification:

- `node scripts/check-dashboard-wallet.cjs`: exact amounts, different wallets, current/transferred rights, creator relationships, unrelated-wallet empty state, partial RPC failures, stale-value isolation, and late-request cancellation.
- `node scripts/check-dashboard-actions.cjs`: existing earnings/support actions remain correct.
- `node scripts/check-navigation-recovery.cjs`: existing navigation and recovery behavior remain correct.
- Production build and full lint pass.
- Isolated browser fixtures verify account switching, retained historical earnings, empty accounts, stable shared totals, scroll reveals, runtime reduced-motion changes, and 320/390/1440px layouts. These fixtures do not connect a real wallet or submit a transaction.

No contract logic, deployed balances, campaign ownership, or transaction behavior changes in this update. Real phone-wallet acceptance remains a separate pending check.
