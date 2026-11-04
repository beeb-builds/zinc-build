# Personal dashboard, project teams and public NFTs

Verified November 4, 2026. This update changes frontend discovery and presentation; it does not modify or deploy the smart contract.

## User paths

- `/`: the personal dashboard. It reads the connected account's exact earnings, current NFT count and project relationships. Disconnected visitors see onboarding and a connect state; no contract RPC reads are needed for this page before connection. Shared platform totals are absent.
- `/explore`: the existing live platform statistics, allocation and revenue charts, and public campaign list. All-wallet metrics are explicitly public.
- `/gallery`: wallet-independent public NFT gallery. It reads campaigns and validates complete per-project rights from `get_campaign_rights`. Cards show actual token IDs, role/share, current owner and original contributor. Search and project filters run locally. A failed project read produces an incomplete-gallery warning; it does not fabricate rights or convert failed reads to an empty collection.
- `/nfts`: current-wallet ownership and transfer management, with an adjacent public-gallery navigation tab.
- `/campaigns/{id}`: project creator, original contributor, current right-holder and treasury roster, followed by visible NFT cards. Original contribution is not reassigned when a right transfers. Treasury is account-based; creation alone does not grant a revenue share. Section links keep deposits and claims accessible.
- Creation result: confirmed campaign NFT cards and explicit encoded token-detail links appear before the support-link section. Links are populated from verified contract reads, not from an assumed campaign ID or local draft. Unavailable reads retain the successful-creation warning and refresh path rather than inviting another submission.

Onboarding offers three working routes: create a project, view contributor rights, or explore projects. Connecting does not automatically mint an NFT or grant team membership. One account can have different roles in different projects; this update does not introduce fake profiles or editable on-chain roles.

## Verification

- `npm run build`: passed, including TypeScript and prerendering for `/explore` and `/gallery`.
- `npm run lint`: passed.
- All 29 `scripts/check-*.cjs` regression harnesses passed. New product-discovery coverage checks ownership identity/share validation, public search, partial/empty snapshots, roster distinctions, verified NFT links, onboarding destinations and the personal home route. Existing creation-result tests now check the minted-right anchors and direct token links.
- Isolated Chrome wallet fixtures passed personal-home, account-switch and unrelated-account empty-state checks. No real wallet was connected or signed in those fixtures.
- Read-only browser journeys against live Testnet data displayed 16 public NFTs across 8 campaigns at verification time. Public search, NFT detail links, project-team links and the separate Explore view worked without wallet connection.
- Fifteen layout checks passed: `/`, `/explore`, `/gallery`, `/campaigns/7`, `/nfts` at 320, 390 and 1440 pixels. No page errors or horizontal overflow were observed. Gallery artwork was visually reviewed.

No campaign, deposit, claim, NFT transfer or private workspace write was submitted during this verification. Physical-phone wallet acceptance remains pending separately.
