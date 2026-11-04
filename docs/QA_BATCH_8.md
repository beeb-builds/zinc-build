# QA batch 8: clean export attempt and storage persistence

Date: 2026-11-03 (Africa/Lagos). No application or smart contract changes,
deployment, push or NEAR transaction.

## 1. Clean working-tree export: installation timed out

Most application files are untracked in the current working tree. A Git-only
checkout would omit them, so this check explicitly used a fresh working-tree
export rather than claiming a published checkout was verified.

Added `scripts/check-clean-export.mjs`. It copies only source/public assets,
package lock, configuration and frontend regression fixtures into an OS
temporary directory. No `.env`, live database, wallet, old build or installed
dependencies are copied. It runs a locked clean install, production build,
lint and the regression scripts, stopping on failure and keeping logs.

Run evidence: `data/clean-export-1793743441798.json`, Node **22.13.1**.
Temporary export: `C:\Users\Genuis\AppData\Local\Temp\zinc-clean-export-vXmKt3`.
The install began at 22:04:01 UTC (23:04 Africa/Lagos) and reached its ten-minute
timeout. The manifest records `ETIMEDOUT`, not a package-resolution or TypeScript
error. Captured stderr contains dependency deprecation warnings. No build, lint
or regression stage ran in this export; **clean reproduction is not certified**.

The helper was subsequently improved to write its initial manifest immediately
and, when available, invoke npm directly through Node so future install timeouts
target npm rather than only its command-shell parent. The original attempt was
not rerun under this changed invocation. The required baseline read helper is
included with the regression fixtures.

## 2. Actual disk persistence across independent processes: passed

Added `scripts/check-storage-restart.cjs`, using actual application store code
and native on-disk SQLite with synthetic, isolated data. A writer exits before
a reader starts; a third process checks changes made by the second. Passed:

- Brief content and revision survive process restart.
- Sessions survive with the correct origin; a different origin remains denied.
- A challenge survives restart and remains consumed after another restart.
- Activity rows and exact yoctoNEAR strings survive; import remains idempotent.
- A stale brief revision is rejected.
- The shared lookup budget persists across processes.

Evidence directory:
`C:\Users\Genuis\AppData\Local\Temp\zinc-storage-restart-Yny2GT`.
This does not test real authentication, live ownership, an HTTP server restart
or hosted volume durability. Existing live databases were not opened.

## Hosting recommendation

The user asked whether Railway can be used. Official Railway documentation
confirms persistent volumes, Next.js support and scheduled volume backups.
Proposed single-service `/data` configuration and verification steps are in
[LOCAL_RELEASE_VERIFICATION.md](LOCAL_RELEASE_VERIFICATION.md). No Railway
project, subscription, volume or deployment was created. A real hosted
restart/redeployment test and clean install/build remain open.

Prior application build results remain historical batch-4 results, not a new
build pass from this attempt.

`git diff --check` passed. The targeted lint invocation for the two new scripts
did not finish after several minutes without output and was stopped; no lint
pass is claimed for this batch. The successful storage test is execution
evidence, not a substitute for the pending lint/clean-build checks.
