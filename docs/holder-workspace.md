# Holder workspace

`/workspace/{campaign_id}` protects a creator-published campaign brief through
server-side authentication and fresh, finalized NEAR reads. Empty workspaces have
no seeded or demonstration brief. Text is app-hosted, not stored in the contract.

## Access and transfer threat model

- A wallet address supplied by a browser is not authentication. The wallet signs
  a NEP-413 challenge; the server verifies its signature and registered full-access
  key using the installed NEAR library.
- Challenges use random 32-byte nonces, expire after five minutes, bind the
  account and origin, and are consumed atomically once before verification.
- Sessions are opaque random tokens, stored hashed in SQLite. Cookies are
  HttpOnly, SameSite=Strict, and Secure on HTTPS. Sessions expire after 15 minutes.
- Every protected read/write verifies that the session's key remains full-access
  on its account and rechecks finalized ownership without the browser read cache.
- A current owner of any contributor NFT for the campaign may read. An original
  contributor who no longer owns any campaign NFT may not. Treasury status does
  not grant access. The immutable campaign creator retains read/publish access as
  a separate editorial role, including if they transfer their own NFT.
- Only the campaign creator may publish. Revision checks prevent silently
  overwriting another edit. Brief text is rendered as text, never HTML.
- Mutation routes require same-origin JSON requests and bounded request bodies.
- A transfer revokes future holder authorization once reflected in finalized
  state. It cannot revoke material already copied/downloaded or a response
  authorized before finality. The UI rechecks every 30 seconds and on focus,
  clearing displayed protected material when verification fails.
- A compromised wallet/session, compromised hosting operator, or compromised
  contract upgrade authority remains outside this access gate's protection.
  This feature is not a cryptographic document-sharing or DRM system.

## Operation

Run on Node 22.13+ with native `node:sqlite` support and a writable persistent
disk. The development runtime reports SQLite as experimental. Default storage is
`data/zinc-workspace.sqlite`, with SQLite WAL sidecars; `/data/` is gitignored.
`ZINC_WORKSPACE_DB` can set an absolute persistent database path. The special
`:memory:` value is for isolated tests only. Briefs are plaintext on disk: secure
the host and backups, and do not put keys/passwords in briefs.

The server process can restart without losing sessions/briefs on persistent disk.
Multiple processes on the same host use SQLite locking. Independent serverless
instances or hosts must use a shared production database; do not deploy this
default local-file setup to ephemeral/read-only serverless storage.

Signing a message is not a NEAR transaction and does not grant spending rights.
The first release supports wallets returning a direct NEP-413 signed message.
Redirect-only message-signing responses are not automatically recovered.

Before signing, the UI now displays a public eligibility preview from the campaign
and revenue-right views. This uses the normal browser read cache and may precede
finality; it is not authentication and cannot grant private access. Unknown or
incomplete ownership is labelled unknown rather than zero. The preview separates
the creator's persistent editorial role, current NFT holders, original contributors
and treasury status. Former owners can link to their retained campaign earnings.

“Recheck existing session” retries the protected read without requesting a new
signature. It still passes the same server session/key/finalized-ownership checks.
A protected ownership denial clears the brief/draft and invalidates the public
read cache so the eligibility explanation can refresh. No private brief data is
passed into the preview and no authorization rules are changed by this UI.

## Verification

`node scripts/check-holder-workspace.cjs` exercises real NEP-413 cryptography and
SQLite, with mocked NEAR ownership/key reads. No network transactions are sent.
Live Sender signing and hosting verification remain separate checks.

`node scripts/check-workspace-eligibility.cjs` checks public preview roles and
rendered fallback states without RPC calls or wallet signatures.
