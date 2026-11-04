# QA batch 9: responsive UI, NFT motion and deployment preparation

Date: 2026-11-03. No contract changes, NEAR transactions or GitHub push.

## UI changes

- `DashboardShell.tsx`: compact phone header/actions, six-item fixed bottom
  navigation, short Activity label with the full Transactions accessible name,
  safe-area padding and reserved content space. Desktop keeps its sidebar.
- `DashboardOverview.tsx`: shrinkable grid tracks/panels, wrapped live values
  and allocation labels, plus campaign cards on phones and a table on desktop.
- `RevenueRightCard.tsx`: CSS-driven orbiting dot and slowly rotating wireframe.
- `globals.css`: reduced-motion support, a brief page entrance and subtle NFT
  hover lift. Moved the control/link font reset into Tailwind's base layer.
  The previous unlayered `font: inherit` overrode utility text sizes, causing
  mobile navigation/control labels to enlarge and wrap.

Motion does not add React timers, wallet calls or RPC polling. Financial data,
ownership, form validation and transaction handling are unchanged.

## Browser verification

Added `scripts/qa-responsive-browser.mjs`, using Playwright 1.64.1 and installed
headless Chrome with a fresh profile. It does not connect a wallet or sign.

**Final combined run passed:** nine routes at 320, 375, 390, 768 and 1440 pixels
(45 checks), plus actual orbit progress and reduced-motion stopping both
animations. Checks include HTTP 200, no document-wide horizontal overflow,
correct navigation breakpoint, six phone links, compact bottom positioning and
enough content padding below the bar.

Routes: `/`, `/campaigns`, `/campaigns/new`, `/campaigns/7`,
`/rights/campaign%3A7%3Aright%3A0`, `/nfts`, `/earnings`, `/transactions`,
`/settings`.

Evidence: `data/responsive-qa-1793746172230/results.json`, full-page screenshots
for every case, and 320/390px overview viewport screenshots. Phone overview and
NFT preview screenshots were visually inspected. These are browser-emulation
checks, not a physical-phone or new signed-wallet acceptance certification.

The first run caught the font-cascade defect and was followed by a fix/rebuild.
A later harness timeout was a selector error: the report exposes a status region,
not a heading. That locator was corrected; the final combined run passed.
The isolated NFT fixture also passed its 11 draft/refresh checks.

To rerun, install Playwright in an isolated tool directory or provide it locally,
set `ZINC_QA_PLAYWRIGHT` to that package directory, run the production app on
port 3000 and the isolated fixture on 3102, then execute
`node scripts/qa-responsive-browser.mjs`. `--motion-only` runs just the separate
fixture/motion checks. It is intentionally excluded from the ordinary
`check-*.cjs` fixture suite and adds no application dependency.

## Build and clean export

The final local `npm run build` passed TypeScript and all 15 generated pages.
All 24 ordinary regression scripts passed locally. The final full `npm run lint`
after the harness corrections also passed with exit code 0, no errors/warnings.
`git diff --check` passed.

The first clean attempt in this batch timed out during dependency installation
while the machine had about 650 MB free RAM. The user closed unused apps; the
install timeout was extended and heavy builds were no longer run concurrently
with the fresh installation. The subsequent clean export successfully completed
`npm ci`, production build, lint and all **24 regression scripts**, each with
exit code 0. The clean pipeline completed successfully.

Clean export: `C:\Users\Genuis\AppData\Local\Temp\zinc-clean-export-r0b1A2`.
Manifest: `data/clean-export-1793745867788.json`, Node 22.13.1.
All 83 current source/public files were compared byte-for-byte to the built
export: passed. Tree SHA-256:
`3979809b82093375a1f7ca5b09e16011d24fe492a12ee46c79035878bc272e31`.
Evidence: `data/clean-source-match.json`.

This is a clean working-tree export, including untracked source, not a claim
that a published Git checkout has been reproduced. The package lock and local
live databases were not changed. Source databases, `.env`, wallet material and
old dependencies/build output were not copied into the export.

## Railway: pending at the user's request

Added `railway.json` (Railpack build/start, activity-store healthcheck and bounded
restart retries), `.node-version` (Node 22) and `.railwayignore` (exclude local
data, environment files, dependencies, build output, contract/test artifacts).
`railway.json` passed validation against Railway's official Draft 2020 schema.
An initial schema check used an older local validator; a compatible isolated
validator subsequently passed without changing the deployment configuration.

The Railway CLI already had an authenticated account. The current folder had
no linked project; existing projects were inspected to avoid changing them.
Creation of a separate `zinc-testnet` project was attempted and refused with
**Your trial has expired. Please select a plan to continue using Railway.**
No Zinc project/service/volume/domain or deployment was successfully created.
The user then chose **Keep deployment pending for now**. Do not retry cloud
mutations until the user resumes deployment.

When resumed after plan activation: create the separate project/service, attach
a volume at `/data`, set both `ZINC_*_DB` paths, deploy the verified source,
verify HTTPS/health/routes, and test host restart/redeployment persistence.
Hosted durability and backups remain unverified; local store restart checks
passed in earlier batches. See [LOCAL_RELEASE_VERIFICATION.md](LOCAL_RELEASE_VERIFICATION.md).
