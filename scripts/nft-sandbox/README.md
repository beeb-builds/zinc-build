# Local NFT upgrade rehearsal

This harness never connects to testnet or reads a wallet credential directory.
It uses `near-sandbox` 0.3.4, NEAR sandbox **2.14.0**, and `near-api-js` 7.2.0
inside a Linux Docker container. No ports are published to the host. RPC must be
loopback and the chain ID must not be `testnet` or `mainnet`.

The pre-NFT fixture restores the exact claims-era financial Borsh layout and
financial method bodies from Zinc. It is a reconstructed equivalent-state
fixture, not a downloaded production code/state snapshot. Its checked-in source
and the report's artifact hashes make that distinction reviewable.

## Run from PowerShell at C:\zinc

Prepare the isolated legacy source:

```powershell
node scripts/nft-sandbox/prepare-fixture.mjs
```

Build that fixture with the existing Windows-compatible Cargo workflow. Keeping
`CARGO_TARGET_DIR` shared reuses dependencies; its output has a different filename
and does not replace the production NFT artifact.

```powershell
$env:CARGO_TARGET_DIR='C:/zinc/contracts/zinc-contract/target'
$env:CARGO_NET_OFFLINE='true'
Set-Location C:/zinc/scripts/nft-sandbox/pre-nft-contract
cargo near build non-reproducible-wasm --no-abi
Set-Location C:/zinc
```

Build the current NFT WASM separately with the production contract's normal
build command if it is not already current. Then install the isolated harness
dependencies and execute:

```powershell
docker run --rm --mount type=bind,source=C:\zinc,target=/workspace -w /workspace/scripts/nft-sandbox node:22-trixie-slim npm ci --no-audit --no-fund
docker run --rm --mount type=bind,source=C:\zinc,target=/workspace --mount type=volume,source=zinc-near-sandbox-cache,target=/tmp -e DIR_TO_DOWNLOAD_BINARY=/tmp/near-binaries -w /workspace/scripts/nft-sandbox node:22-trixie-slim node rehearse.mjs
```

Only the project is mounted; no `.near-credentials`, keychain, or testnet config
is mounted from the user's home directory. The sandbox package downloads its
version-pinned Linux binary on the first run. NEAR 2.14.0 needs glibc 2.39 or newer,
so use the Trixie image rather than Bookworm. The Docker-managed Linux `/tmp`
volume keeps binary downloads and their destinations on one filesystem, avoiding
the package's cross-device `rename` failure on a Windows bind mount. It also
keeps RocksDB chain I/O off the Windows filesystem. Local account keys live in memory
or the container's temporary sandbox directory and are not put in reports.

## Assertions and output

The main fixture creates two campaigns, deposits 10 and 8 NEAR, and completes a
4 NEAR treasury claim. Alice retains 2.5 NEAR of unclaimed historical revenue in
campaign 0. An atomic deploy-plus-migrate batch then checks:

- All campaign fields/order/IDs, deposited totals, and the entire Borsh
  claimed/pending ledger are unchanged.
- Claimed and claimable views match for every fixture beneficiary.
- Six deterministic NFTs are minted, one per contributor, none to treasury.
- Replaying migration fails atomically without changing state or NFT supply.
- Alice transfers her campaign-0 NFT to Bob with one yoctoNEAR attached.
- Alice retains her historical 2.5 NEAR; Bob receives none of that history.
- A later 10 NEAR deposit earns Bob 2.5 NEAR and does not add to Alice's balance.
- Both Bob and Alice actually claim their respective entitlements. Native
  account balances increase, payout callbacks return true, and all descendant
  receipts reach `FINAL`.

A second independently funded pre-NFT fixture isolates `migrate_nfts()` gas from
WASM deployment gas. Its non-atomic upgrade is deliberate and LOCAL ONLY for
measurement; live upgrades should use an atomic deploy-and-migrate batch.

`artifacts/results.json` is the authoritative completed run. It includes node
version/protocol, code hashes, transaction hashes, gas and receipt details,
storage growth (code and state separately), and a fixture-specific balance
recommendation. `receipt-*.json`, `before.json`, and `after-migration.json` retain
the underlying evidence. A failed run writes `results-failed.json` instead of
claiming success. Generated reports contain public local-chain data, not keys.

The recommended balance is the outstanding beneficiary liabilities plus full
post-upgrade storage stake, a transaction gas budget, at least one NEAR of
headroom, then rounded up to whole NEAR. It is a synthetic-fixture estimate, not
a quote for production. Recalculate from an exact live backup before deployment.

Review the corresponding findings in `artifacts/REPORT.md` after the completed
rehearsal. Nothing in this harness authorizes deployment to a public network.
