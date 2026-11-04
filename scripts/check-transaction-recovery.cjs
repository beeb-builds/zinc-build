// Local regression checks only: mock RPC and storage, never sign or send transactions.
const fs = require("fs"), ts = require("typescript"), vm = require("vm"), assert = require("node:assert/strict");
const { webcrypto } = require("node:crypto");
const compile = (path) => ts.transpileModule(fs.readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const network = { NEAR_NETWORK_ID: "testnet", ZINC_CONTRACT_ID: "zinc-builder-2026.testnet", NEAR_RPC_URL: "mock://rpc" };
const memory = new Map();
let blockedStorage = false;
const storage = { getItem: (key) => { if (blockedStorage) throw new Error("storage unavailable"); return memory.get(key); }, setItem: (key, value) => { if (blockedStorage) throw new Error("storage unavailable"); memory.set(key, value); } };
function journal() {
  const api = {};
  vm.runInNewContext(compile("src/lib/transaction-journal.ts"), { exports: api, require: () => network, localStorage: storage, crypto: webcrypto, window: { dispatchEvent() {} }, Event: class {}, Date });
  return api;
}
const verify = {};
vm.runInNewContext(compile("src/lib/verify-transaction.ts"), { exports: verify, require: () => network, atob, TextDecoder, Uint8Array });
const confirmation = {};
vm.runInNewContext(compile("src/lib/campaign-confirmation.ts"), { exports: confirmation, require: (id) => id === "./near" ? network : verify, atob, TextDecoder, Uint8Array });
const details = { accountId: "alice.testnet", method: "claim_revenue", args: { campaign_id: 6 }, deposit: "0", kind: "Claims", campaignId: 6 };
function outcome(attempt, result = true) {
  return { final_execution_status: "FINAL", transaction: { hash: "1".repeat(44), signer_id: attempt.accountId, receiver_id: network.ZINC_CONTRACT_ID,
    actions: [{ FunctionCall: { method_name: attempt.method, deposit: attempt.deposit, args: Buffer.from(JSON.stringify(attempt.args)).toString("base64") } }] },
    status: { SuccessValue: btoa(JSON.stringify(result)) }, transaction_outcome: { outcome: { status: { SuccessReceiptId: "receipt" } } },
    receipts_outcome: [{ outcome: { status: { SuccessValue: "" } } }] };
}
(async () => {
  let store = journal();
  const attempt = store.beginTransactionAttempt(details);
  assert.throws(() => store.beginTransactionAttempt(details), /matching request/);
  store = journal(); // Simulated reload restores only persisted data.
  assert.equal(store.readTransactionAttempts()[0].id, attempt.id);
  assert.equal(store.readTransactionAttempts()[0].state, "waiting");
  const receipt = outcome(attempt);
  verify.verifyAttemptIdentity(receipt, attempt, receipt.transaction.hash);
  assert.equal(verify.verifyExecution(receipt, true).state, "confirmed");
  for (const mutate of [
    (tx) => { tx.transaction.signer_id = "bob.testnet"; },
    (tx) => { tx.transaction.receiver_id = "other.testnet"; },
    (tx) => { tx.transaction.actions[0].FunctionCall.method_name = "deposit_revenue"; },
    (tx) => { tx.transaction.actions[0].FunctionCall.deposit = "1"; },
    (tx) => { tx.transaction.actions[0].FunctionCall.args = btoa('{"campaign_id":7}'); },
    (tx) => { tx.transaction.actions.push({ Transfer: { deposit: "1" } }); },
  ]) {
    const changed = structuredClone(receipt); mutate(changed);
    assert.throws(() => verify.verifyAttemptIdentity(changed, attempt, receipt.transaction.hash));
  }
  assert.equal(verify.verifyExecution(outcome(attempt, false), true).state, "failed");
  assert.equal(verify.verifyExecution(outcome(attempt, "unexpected"), true).state, "unconfirmed");
  const failed = structuredClone(receipt); failed.receipts_outcome[0].outcome.status = { Failure: "failed" };
  assert.equal(verify.verifyExecution(failed, true).state, "failed");
  const pending = structuredClone(receipt); pending.status = "Started";
  assert.equal(verify.verifyExecution(pending, true).state, "unconfirmed");
  // Unicode arguments and property order are checked semantically.
  const unicode = { ...attempt, method: "create_campaign", args: { name: "Créateurs 音楽", description: "Revenue" } };
  const unicodeReceipt = outcome(unicode); unicodeReceipt.transaction.actions[0].FunctionCall.args = Buffer.from(JSON.stringify({ description: "Revenue", name: "Créateurs 音楽" })).toString("base64");
  verify.verifyAttemptIdentity(unicodeReceipt, unicode, unicodeReceipt.transaction.hash);

  let rpcResult = receipt, lookupFailed = false;
  const recorded = [], recovery = {};
  vm.runInNewContext(compile("src/lib/recover-transaction.ts"), { exports: recovery, atob, require: (id) => {
    if (id === "near-api-js") return { JsonRpcProvider: class { async viewTransactionStatus(options) { assert.equal(options.waitUntil, "FINAL"); if (lookupFailed) throw new Error("RPC unavailable"); return rpcResult; } } };
    if (id === "./near") return network;
    if (id === "./transaction-journal") return store;
    if (id === "./verify-transaction") return verify;
    if (id === "./campaign-confirmation") return confirmation;
    if (id === "./zinc-activity") return { recordConfirmedActivity: (...args) => recorded.push(args) };
    throw new Error(`Unexpected dependency ${id}`);
  } });
  rpcResult = { ...receipt, final_execution_status: "EXECUTED" };
  await recovery.recoverTransaction(attempt, receipt.transaction.hash);
  assert.equal(store.readTransactionAttempts()[0].state, "unconfirmed"); assert.equal(recorded.length, 0);
  lookupFailed = true; await assert.rejects(recovery.recoverTransaction(attempt, receipt.transaction.hash));
  assert.equal(store.readTransactionAttempts()[0].state, "unconfirmed");
  lookupFailed = false; rpcResult = receipt;
  await recovery.recoverTransaction(attempt, receipt.transaction.hash);
  assert.equal(store.readTransactionAttempts()[0].state, "confirmed"); assert.equal(recorded.length, 1);
  const bob = store.beginTransactionAttempt({ ...details, accountId: "bob.testnet" });
  assert.equal(store.readTransactionAttempts().filter((entry) => entry.accountId === "bob.testnet").length, 1);
  await assert.rejects(recovery.recoverTransaction(bob, receipt.transaction.hash), /already linked/);
  store.dismissTransactionAttempt(bob.id);
  assert.equal(store.readTransactionAttempts().length, 1);
  // Recovered creation IDs survive reload and come only from confirmed return data.
  const creation = store.beginTransactionAttempt({ ...details, method: "create_campaign", args: { name: "Music" }, kind: "Campaigns", campaignId: undefined });
  rpcResult = outcome(creation, { id: 0, name: "Music" }); rpcResult.transaction.hash = "2".repeat(44);
  await recovery.recoverTransaction(creation, rpcResult.transaction.hash);
  assert.equal(journal().readTransactionAttempts().find((row) => row.id === creation.id).campaignId, 0);
  assert.equal(recorded.at(-1)[1].campaignId, 0);
  for (const [index, value] of [{ id: -1 }, { id: "7" }, { id: Number.MAX_SAFE_INTEGER + 1 }, {}].entries()) {
    const unknown = store.beginTransactionAttempt({ ...creation, args: { name: `Unknown ${index}` }, campaignId: 999 });
    rpcResult = outcome(unknown, value); rpcResult.transaction.hash = String(index + 3).repeat(44);
    await recovery.recoverTransaction(unknown, rpcResult.transaction.hash);
    const saved = journal().readTransactionAttempts().find((row) => row.id === unknown.id);
    assert.equal(saved.state, "confirmed"); assert.equal(saved.campaignId, undefined);
  }
  const pendingCreation = store.beginTransactionAttempt({ ...creation, args: { name: "Pending" } });
  rpcResult = outcome(pendingCreation, { id: 42 }); rpcResult.transaction.hash = "7".repeat(44); rpcResult.final_execution_status = "EXECUTED";
  await recovery.recoverTransaction(pendingCreation, rpcResult.transaction.hash);
  assert.equal(store.readTransactionAttempts().find((row) => row.id === pendingCreation.id).campaignId, undefined);

  // Real React output: only confirmed results expose action-specific completion links.
  const React = require("react"), { renderToStaticMarkup } = require("react-dom/server");
  const view = {};
  const viewCode = ts.transpileModule(fs.readFileSync("src/components/transactions/RecoveryOutcome.tsx", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  vm.runInNewContext(viewCode, { exports: view, require: (id) => id === "next/link" ? { __esModule: true, default: ({ href, children, ...props }) => React.createElement("a", { href, ...props }, children) } : require(id) });
  const render = (extra) => renderToStaticMarkup(React.createElement(view.default, { attempt: { ...attempt, state: "confirmed", ...extra } }));
  assert.equal(render({ state: "unconfirmed" }), ""); assert.equal(render({ state: "failed" }), "");
  assert.ok(render({ method: "create_campaign", campaignId: 0 }).includes('href="/campaigns/0"'));
  assert.ok(render({ method: "create_campaign", campaignId: undefined }).includes("before creating another campaign"));
  assert.ok(render({ method: "deposit_revenue" }).includes("latest deposited total"));
  assert.ok(render({ method: "claim_revenue" }).includes('href="/campaigns/6#claim-revenue"'));
  const transfer = render({ method: "nft_transfer", tokenId: "campaign:6:right:0" });
  assert.ok(transfer.includes(`/rights/${encodeURIComponent("campaign:6:right:0")}`));
  assert.ok(transfer.includes('href="/earnings"')); assert.ok(transfer.includes('href="/nfts"'));
  assert.ok(transfer.includes("may have changed since then")); assert.ok(!transfer.includes("<button"));
  blockedStorage = true;
  const fallback = journal(); fallback.beginTransactionAttempt({ ...details, accountId: "fallback.testnet" });
  assert.equal(fallback.recoveryStorageUnavailable(), true); assert.equal(fallback.readTransactionAttempts().length, 1);
  console.log("PASS: reload persistence, unresolved-repeat guard, input/owner/hash verification, Unicode arguments, finality, payout callbacks, failed receipts, RPC uncertainty, account isolation, dismissal, storage fallback, verified creation ID persistence, missing-ID fallback, and action-specific completion links. No network transactions sent.");
})().catch((error) => { console.error(error); process.exitCode = 1; });
