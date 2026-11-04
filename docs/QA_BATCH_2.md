# Batch 2: lint cleanup and browser QA

Date: 2026-11-02. No contract changes, public write transactions, deployment or push.

## 1. Lint and regression baseline

The first cleanup lint run completed with **0 errors and 0 warnings** (previous
audit: 167 errors). See [LINT_POLICY.md](LINT_POLICY.md) for the exact scope:
CommonJS Node harness configuration, statement-level external synchronization
exceptions, and request-time server clock exceptions. React rules remain enabled
globally. This is not a claim that all effects were refactored or render counts
were reduced.

Campaign discovery and public-payment server routes now return JSX outside their
data `try/catch` blocks. All original 20 regression scripts passed again, and the
production build passed after these changes.

## 2. Real browser smoke QA

Environment: existing Chrome Incognito window, a fresh disconnected origin at
`http://localhost:3100`, using `npm run start -- --port 3100` after the production
build. The old port-3000 tab was not accepted as evidence for this build.
Native computer-use screenshots and accessibility snapshots were inspected;
no browser console code was executed and no wallet provider was selected.

| Case | Observed result |
| --- | --- |
| Overview | Live reads loaded: 15 NFTs, seven campaigns, 0.09 NEAR lifetime deposits, one active campaign. These are point-in-time observations, not fixed expected production totals. |
| My NFTs disconnected | Clear connect-wallet message, NFT/revenue explanation and public campaign link; no fabricated owned NFTs. |
| Earnings disconnected | Clear connect-wallet state; no invented balances or claim control. |
| Settings | Disconnected status, Testnet label, contract account and FastNEAR RPC endpoint displayed correctly. |
| Wallet selector | Opened from Settings, displayed Sender and other wallets, closed with its cancel control; account stayed disconnected. This does not verify Sender authentication or signing. |
| Transactions | Activity page loaded with campaign creation evidence and explicit indexing/per-token payout limitations. No historical import or write was submitted. |
| Campaign discovery | Loaded seven campaigns; Active filter showed only campaign #2, while global totals stayed at seven campaigns and 0.09 NEAR. |
| Campaign #2 detail | Loaded 0.01 NEAR deposited, exact UTC times, Active status, three rights, separate 40% treasury and 100% allocation. Disconnected claim button was disabled. |
| Contributor NFT cards | Visible 25% Artist card with NFT artwork and current/original ownership explanation. Clicking it exposed the encoded-route defect below. |

No obvious layout obstruction was observed at the approximately 1010-pixel-wide
desktop window. This is not a contrast/accessibility certification or a full
responsive QA pass. Attempts to narrow the window/open responsive tools did not
produce a confirmed mobile viewport; narrow/mobile behavior remains unverified.

## Defect found and fixed during QA

Opening `/rights/campaign%3A2%3Aright%3A0` from its real card incorrectly rendered
"Revenue right not found". A read-only public `nft_token` call confirmed the token
exists. The local server's serialized payload showed this Next.js build passing
the percent-encoded string as `params.tokenId`; the client rejected it before RPC.

The server route now decodes the segment **exactly once** before passing it to the
existing detail component. Raw IDs remain compatible. Malformed and double-encoded
IDs still fail the client's token grammar and do not trigger arbitrary token reads.
`scripts/check-right-route.cjs` exercises the actual async route and client lookup:
it passed, including exact token IDs and malformed/double-encoded input cases.

Final build after the fix: **passed**, including TypeScript and prerendering.
The same encoded URL was reloaded in the rebuilt production server and now
displays the real 25% Artist NFT, token `campaign:2:right:0`, current owner
`artist.testnet`, campaign #2, history limitations and campaign earnings context.
The previous not-found result is resolved in the real browser.

Final full `npm run lint`: **passed, 0 errors and 0 warnings**. The original 20 regression scripts
and the new encoded-route check passed (21 scripts total, no signed transactions).

## Still requires acceptance testing

- Actual Sender session restoration, account switching and two-wallet signing.
- Campaign creation, deposit rejection/success, completed claims, transfer then
  later deposit, and historical-versus-future balance verification through UI.
- Current-holder NEP-413 signing, stale-session revocation after transfer, and
  the separate creator editorial role in the real browser.
- Narrow/mobile viewport, keyboard-only flow, contrast review, deliberate offline
  and error-boundary exercises, and a real start/end clock boundary.
- HTTPS hosting, persistent database restart and second-browser activity coverage.

The fixture suite and this public-browser smoke pass do not certify those cases.
