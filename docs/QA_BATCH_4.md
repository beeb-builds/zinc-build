# Batch 4: transfer draft continuity and regression coverage

Date: 2026-11-03. This follows the successful core two-wallet campaign #7 test
recorded in [TWO_WALLET_ACCEPTANCE.md](TWO_WALLET_ACCEPTANCE.md).

## 1. Preserve transfer drafts during ownership refresh

Live QA exposed a reproducible problem: returning focus to the browser refreshed
My NFTs, cleared the owned list and unmounted every NFT card. An open details
section, entered receiver and transfer review disappeared before signing.

`src/components/nfts/MyNfts.tsx` now retains the last loaded, keyed NFT cards
while ownership is refreshed. The input/review component remains mounted.
A visible refresh status explains that confirmation is paused. Transfer controls
are disabled during the ownership read and after a failed read; retry restores
them only after a successful refresh. A successful read removes rights no longer
owned, and a confirmed transfer immediately removes its card. An account change
still remounts the account-keyed portfolio and clears the previous account's draft.

The fresh `nft_token` ownership check immediately before requesting a wallet
transaction remains in place. No smart contract, transaction deposit, wallet
provider, NFT allocation or financial accounting behavior changed. Drafts are
kept in component memory, not persisted across a page reload or account switch.

## 2. Regression check

`scripts/check-nft-refresh.cjs` executes the actual component with mocked React
hooks and RPC/write dependencies. It checks stable card type/key and receiver /
review state across pending, successful and failed refreshes; disabled stale
confirmation; fresh-owner rejection before any write; removal of lost rights;
and account-specific portfolio keys. It does not submit wallet/network calls.
This is component/handler coverage, not a real DOM/browser reconciliation test.

The focused check passed, and all **23** `scripts/check-*.cjs` regression scripts
passed with zero failures. Full lint and production build also passed, including
TypeScript and all 15 generated pages. The agent's local server was stopped
before rebuilding and restarted on port 3000 afterward to avoid mismatched assets.
The first browser attempt ended when computer use could not reliably identify
the current URL. Subsequent browser attempts are recorded in QA_BATCH_5.md;
passing hook fixtures alone does not certify real browser draft preservation.
