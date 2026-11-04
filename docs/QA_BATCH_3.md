# Batch 3: mobile QA and two-wallet acceptance preparation

Date: 2026-11-02. No contract changes, public write transactions, deployment or push.

## Mobile browser checks

Chrome Incognito, local production server on port 3100, DevTools Responsive
emulation. Observations are browser emulation, not a physical-phone certification.

- NFT detail artwork, ownership information and actions fit at 400, 375 and 320
  CSS pixels. The six-link mobile navigation remained reachable after scrolling.
- At 320px, campaign discovery summaries, search and sort stacked; status filters
  wrapped and remained usable. The Create Campaign link opened the real form.
- Creation-form inspection exposed slight horizontal overflow. Grid tracks and
  date/contributor/treasury inputs now allow shrinking inside their container.
  Validation and transaction logic are unchanged.
- Replaced stale creation-page copy about a future NEAR connection with the
  actual Testnet campaign creation and contributor NFT minting behavior.

After the production rebuild, the form was reloaded at 320px. Date fields,
stacked contributor role/account/share inputs and treasury account/share inputs
fit their cards. A horizontal-scroll attempt did not shift the page. The compact
navigation stayed reachable. No form submission or wallet signature was made.
Keyboard-only, contrast, physical-device and deliberate offline checks remain
open.

Final `npm run build`: **passed**, including TypeScript and all 15 generated
pages. Final `npm run lint`: **passed**, no errors or warnings. Native SQLite's
experimental-runtime warning appeared during the build; it was not a build
failure. `git diff --check` passed before the documentation updates.

## Two-wallet acceptance preparation

See [TWO_WALLET_ACCEPTANCE.md](TWO_WALLET_ACCEPTANCE.md) for the exact scenario
and expected accounting. Both public IDs supplied by the user are identical;
the actual two-wallet transfer/signing test has not run.

Added `scripts/read-wallet-baseline.mjs`: read-only, finalized-block-pinned
campaign/right/claim snapshots for one or two distinct public Testnet accounts.
It preserves exact yoctoNEAR strings, validates complete responses, bounds
concurrency and writes a new evidence file for each successful snapshot.
It cannot sign or submit a transaction.

The real wallet A snapshot at block 275926400 recorded seven campaigns, no
currently owned contributor rights, zero claimable revenue and 0.012 NEAR
previously claimed in campaign #6. These are point-in-time observations.
No A-owned right was available for a direct transfer in that snapshot.

`scripts/check-wallet-baseline.cjs` tests pinned reads, exact large/zero amounts,
distinct accounts, bounded concurrency, malformed/incomplete data rejection,
HTTP errors and the read-only RPC allowlist. All 22 regression scripts passed
with zero failures. Their fixtures do not constitute live wallet acceptance.

## Remaining acceptance work

- Supply a different wallet B account and execute the dedicated campaign,
  deposits, transfer and completed claims with user-controlled signatures.
- Verify real Sender restoration/switching and holder-workspace session
  revocation after transfer. No authentication/signing step is automated here.
- Finish the broader readiness items in
  [HACKATHON_READINESS.md](HACKATHON_READINESS.md).
