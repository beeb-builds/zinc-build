# Local release verification

Latest result: [QA batch 9](QA_BATCH_9.md) completed a clean working-tree
install/build/lint and 24 regression scripts successfully. Responsive browser
and reduced-motion checks also passed. Railway creation was refused because
the account trial expired; the user explicitly kept deployment pending.

These commands do not deploy Zinc or send NEAR transactions.

## Reproduce without local dependencies or private data

Run `node scripts/check-clean-export.mjs` from the repository. It copies the
frontend source, public assets, package lock, configuration and regression
fixtures into a fresh operating-system temporary directory. It does not copy
`.env`, Git metadata, installed packages, SQLite files or previous build output.
It runs `npm ci`, `npm run build`, `npm run lint` and every `check-*.cjs` regression.
Per-stage logs remain in the temporary export; the result manifest is written to
the local, gitignored `data/` directory. The process can use network access to
install dependencies. Temporary exports are retained for diagnosis.

This is a **working-tree export**, including untracked source. It does not prove
that a clone of the published repository contains those files. Once a release
commit is chosen and published by the owner, repeat the build from that exact
commit in a separate checkout. Do not report the export as a clean Git clone.

## Verify local durable storage

Run `node scripts/check-storage-restart.cjs` on Node 22.13 or later. It runs the
actual workspace/activity store code against real on-disk SQLite files, using
three independent child processes. All accounts, briefs and activity rows are
synthetic and isolated in a new temporary directory. It does not open the live
application databases, verify real transactions or call NEAR RPC.

The check verifies persistence of briefs/revisions, scoped sessions, consumed
challenges, exact activity amounts, idempotent imports and the shared lookup
budget. Authentication/ownership rules are covered separately by the workspace
regression; a persisted session never bypasses fresh ownership/key checks.

## Hosting checks still required

Use a Node server with persistent writable storage for both database paths:

- `ZINC_WORKSPACE_DB`: absolute path on the persistent volume.
- `ZINC_ACTIVITY_DB`: separate absolute path on the persistent volume.

Both SQLite databases use WAL sidecar files. Mount the containing directory,
not only an individual `.sqlite` file. A local process test does not establish
that a hosting service preserves that volume during restart, redeployment or
instance replacement. Independent ephemeral instances do not share local files.

Once a host is selected, verify HTTPS, fresh-account wallet behavior, real
authorized and denied workspace reads, and actual history persistence through
restart/redeployment on that host. Keep private brief data out of public logs
and public backup locations. Use SQLite's backup facility or stop database
writers before taking a consistent backup; copying only a live main file can
omit committed WAL contents.

No host is selected or deployed by these scripts. Release approval and public
submission remain separate steps.

## Proposed Railway setup (not deployed)

Railway is suitable for the current single-instance SQLite prototype. This is
a proposed configuration, not a claim of hosted verification:

- One Node app service; use Node 22.13+ for native `node:sqlite`.
- Install from `package-lock.json`; build with `npm run build`.
- Start with `npm run start -- --hostname 0.0.0.0 --port $PORT` in the Linux
  runtime, using Railway's assigned port.
- Attach a persistent volume mounted at `/data`.
- Set `ZINC_WORKSPACE_DB=/data/zinc-workspace.sqlite` and
  `ZINC_ACTIVITY_DB=/data/zinc-activity.sqlite` as runtime variables.
- Generate an HTTPS domain and configure scheduled volume backups.
- Keep the SQLite service on one instance; verify restart/redeployment and
  backup restoration before relying on the host for the judge demo.

Existing local workspace briefs and imported activity do not automatically
appear in a new Railway volume. Campaigns, NFTs and revenue remain on NEAR and
are read from the existing contract; hosted workspace/history data is separate.
If local application data needs moving, use a deliberate consistent backup and
restore rather than uploading all local files. No data is migrated here.

Official references checked November 3, 2026:
[Next.js deployment](https://railway.com/guides/nextjs),
[persistent volumes](https://docs.railway.com/volumes/reference),
[backups](https://docs.railway.com/volumes/backups),
[pricing](https://railway.com/pricing).
