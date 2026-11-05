# Wallet session recovery

November 5, 2026. Frontend changes only; no contract upgrade or migration.

## Problem and behavior

During hosted acceptance, Nightly returned `Not connected` while Zinc still
showed its cached account. The installed Wallet Selector adapter can return that
account without checking `isConnected`; its modal can also skip sign-in for an
already-selected wallet. Zinc now checks the injected session and explicitly
reconnects Nightly when the user requests it. This addresses those frontend
paths, not the underlying reason the extension disconnected.

- Focus, visibility, storage and session events recheck local provider state.
  A ten-second foreground check catches disconnects without extension events.
  These checks make no RPC requests and open no wallet prompts.
- Disconnected, mismatched or replaced providers clear the displayed account,
  preventing the previous account's personal balances from staying visible.
- Reconnect is an explicit user action, protected against duplicate clicks.
  Cancellation leaves Zinc disconnected; replacing the provider requires reload.
- Transaction and message signing validate the session first. Other wallets
  retain their existing signing behavior.
- A request stopped before signing is recorded as **not submitted**, where an
  attempt record already exists. It does not block a subsequent manual retry.
- Once a signing method has been invoked, an ambiguous failure stays
  **unconfirmed**. Check wallet activity and Transaction recovery before retrying.
  Existing unknown records are neither deleted nor automatically resubmitted.

## Verification

All 30 `scripts/check-*.cjs` regressions passed, including the new
`check-wallet-session.cjs`. The production build passed. Tests cover local
session changes, account isolation, signing guards, payload/result preservation,
uncertain outcomes and journal behavior.

Six isolated Chrome journeys against the local production build passed:
silent disconnect, explicit selected-wallet reconnect, account mismatch,
cancelled reconnect, manual retry after cancellation and replaced provider.
The browser used a synthetic provider and mocked RPC, with no signing requests
or real transactions. These fixtures do not establish real-extension or
physical-phone acceptance. A real Nightly reconnect and phone connection retest
remain required; no additional financial transaction is needed to check reconnect.
