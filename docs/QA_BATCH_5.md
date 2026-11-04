# Batch 5: browser follow-up and judge documentation

Date: 2026-11-03. No smart contract or frontend application code changed in this
batch. No deployment, GitHub push or submission was performed.

## 1. Browser follow-up

The rebuilt `/nfts` page was opened with wallet B, showing its campaign #7 NFT.
A receiver draft for A was entered for a UI-only preservation check. During the
check, user input was detected and a Nightly unlock/signing request appeared.
The agent stopped interacting with the wallet dialog and requested cancellation.
The user subsequently reported the transaction was already signed.

The resulting B-to-A return transfer was verified by live views at finalized
block 276057974 and by the browser's confirmed transfer receipt. A owns the NFT
again. Claim accounting is unchanged: A claimed 0.006 NEAR, B claimed 0.014 NEAR,
both claimable zero, deposits 0.02 NEAR. Public hash and snapshot reference are in
[TWO_WALLET_ACCEPTANCE.md](TWO_WALLET_ACCEPTANCE.md).

The browser continued to show B connected with zero current rights and the token
under Transferred Rights, owned by A. Current/previous ownership and historical
claim labels were visible. The account that owns the right must be connected to
finish the draft-only test. The requested focus/tab-switch preservation check
was interrupted and is **not certified by this run**. No additional financial
transaction is needed to verify that behavior.

## 2. README and judge demo guide

Replaced the Next.js scaffold README with actual Zinc setup, configuration,
architecture, exact accounting, custody, transfer/security boundaries, workspace
roles, persistence requirements, commands, live evidence and limits. Added
[JUDGE_DEMO.md](JUDGE_DEMO.md) with do-X/see-Y steps, a fresh two-wallet scenario,
the recorded transaction links and a three-minute recording outline.

The docs explicitly distinguish recorded B ownership at block 276052836 from
the later return to A. They do not claim per-token payout indexing, subaccounts,
marketplace sales, external income capture, independent audit or production
readiness. Generated local evidence is gitignored; public hashes remain linked.

Updated readiness with the official-rule clarification: integrations are
optional (Q-011), and track prompts are examples. The main NFT track remains the
target; central-contract custody is disclosed. Public release, license choice,
baseline/submission refs, clean-checkout verification and hosting remain open.

Application validation inherited from the immediately preceding batch: all 23
regression scripts, lint and build passed. This documentation-only batch does
not rerun contract/sandbox tests or claim another financial acceptance run.
Local Markdown link verification passed for all six changed documents, and
`git diff --check` passed. The connected header still showed B at the final
browser observation; connection of A was requested without any transfer approval.

The user later connected A; its receiver draft was populated. Computer use
stopped on the tab-switch attempt because the current URL could not be reliably
identified. The user then confirmed another wallet transfer. At finalized block
276058888, B owned the NFT again; claimed/deposit totals were unchanged and both
claimable values zero. See the acceptance report. This does not complete the
draft-preservation browser check. No additional transfer is needed.
