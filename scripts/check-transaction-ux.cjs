// Local regression checks. Uses mocked wallets; never sends network transactions.
const fs = require("fs");
const ts = require("typescript");
const vm = require("vm");
const assert = require("node:assert/strict");
const transpile = (path) => ts.transpileModule(fs.readFileSync(path, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
}).outputText;

(async () => {
  const near = await import("near-api-js");
  const core = await import("@near-wallet-selector/core");
  const observer = {};
  vm.runInNewContext(transpile("src/lib/transaction-progress.ts"), { exports: observer });
  const recorded = [], calls = [], steps = [];
  const attempts = [], updates = [];
  let returned;
  const success = (value = "") => ({
    transaction: { hash: "1".repeat(44), signer_id: "alice.testnet", receiver_id: "zinc-builder-2026.testnet" },
    status: { SuccessValue: value }, transaction_outcome: { outcome: { status: { SuccessReceiptId: "receipt" } } },
    receipts_outcome: [{ outcome: { status: { SuccessValue: "" } } }],
  });
  const selector = {
    store: { getState: () => ({ accounts: [{ accountId: "alice.testnet", active: true }] }) },
    wallet: async () => ({ signAndSendTransaction: async (options) => {
      calls.push(options);
      if (returned instanceof Error) throw returned;
      return returned;
    } }),
  };
  const writes = {};
  const walletSession = {};
  vm.runInNewContext(transpile("src/lib/wallet-session.ts"), { exports: walletSession });
  const verification = {};
  vm.runInNewContext(transpile("src/lib/verify-transaction.ts"), { exports: verification, atob, TextDecoder, Uint8Array,
    require: () => ({ ZINC_CONTRACT_ID: "zinc-builder-2026.testnet" }) });
  vm.runInNewContext(transpile("src/lib/zinc-write.ts"), { exports: writes, atob, require: (id) => {
    if (id === "near-api-js") return near;
    if (id === "@near-wallet-selector/core") return core;
    if (id === "./near") return { ZINC_CONTRACT_ID: "zinc-builder-2026.testnet" };
    if (id === "./transaction-progress") return observer;
    if (id === "./zinc-activity") return { recordConfirmedActivity: (...args) => recorded.push(args) };
    if (id === "./transaction-journal") return { beginTransactionAttempt: () => { attempts.push(true); return { id: "mock-attempt" }; }, updateTransactionAttempt: (_id, value) => updates.push(value) };
    if (id === "./verify-transaction") return verification;
    if (id === "./read-scheduler") return { browserReads: { invalidate() {} }, beginBrowserWrite: () => () => {} };
    if (id === "./wallet-session") return walletSession;
    return require(id);
  } });
  returned = success();
  await writes.transferRevenueRightOnNear(selector, "campaign:6:right:0", " bob.testnet ", "alice.testnet", (step) => steps.push(step));
  assert.equal(calls[0].actions[0].functionCall.deposit, 1n);
  assert.equal(JSON.parse(Buffer.from(calls[0].actions[0].functionCall.args).toString()).receiver_id, "bob.testnet");
  assert.deepEqual(steps.map((step) => step.phase), ["preparing", "wallet", "verifying"]);
  assert.equal(steps[2].hash, "1".repeat(44));
  const before = calls.length;
  await assert.rejects(writes.transferRevenueRightOnNear(selector, "campaign:6:right:0", "bob.testnet", "changed.testnet"));
  assert.equal(calls.length, before);
  returned = success();
  await writes.depositRevenueOnNear(selector, 6, "0.000000000000000000000001");
  assert.equal(calls.at(-1).actions[0].functionCall.deposit, 1n);
  returned = success(btoa("true"));
  await writes.claimRevenueOnNear(selector, 6);
  const count = recorded.length;
  returned = success(btoa("false"));
  await assert.rejects(writes.claimRevenueOnNear(selector, 6));
  assert.equal(recorded.length, count);
  returned = success(btoa("true"));
  returned.receipts_outcome[0].outcome.status = { Failure: "payout failed" };
  await assert.rejects(writes.claimRevenueOnNear(selector, 6));
  assert.equal(recorded.length, count);
  returned = undefined;
  await assert.rejects(writes.depositRevenueOnNear(selector, 6, "1"));
  returned = new Error("User rejected");
  await assert.rejects(writes.transferRevenueRightOnNear(selector, "campaign:6:right:0", "bob.testnet", "alice.testnet"));
  assert.equal(updates.at(-1).state, 'unconfirmed', 'An error after invoking signing must not be called not-submitted');
  const beforePreflight = attempts.length;
  const disconnected = { ...selector, store: { getState: () => ({ selectedWalletId: 'nightly', accounts: [{ accountId: 'alice.testnet', active: true }] }) } };
  await assert.rejects(writes.claimRevenueOnNear(disconnected, 6), /No signing request was sent/);
  assert.equal(attempts.length, beforePreflight, 'Disconnected preflight creates no unresolved journal entry');
  let selectedWalletId;
  const race = { store: { getState: () => ({ selectedWalletId, accounts: [{ accountId: 'alice.testnet', active: true }] }) },
    wallet: async () => { selectedWalletId = 'nightly'; return { signAndSendTransaction() { throw Error('Must not reach signing'); } }; } };
  await assert.rejects(writes.claimRevenueOnNear(race, 6), /No signing request was sent/);
  assert.equal(updates.at(-1).state, 'not-submitted', 'A disconnect after preparation remains recorded but does not block safe retry');

  let state;
  const hooks = {};
  vm.runInNewContext(transpile("src/components/transactions/TransactionProgress.tsx"), { exports: hooks, require: (id) => id === "react" ? {
    useState: () => [state, (update) => { state = typeof update === "function" ? update(state) : update; }],
    useRef: () => ({ current: false }),
  } : require(id) });
  const transaction = hooks.useTransactionProgress();
  await transaction.run(async (report) => { report({ phase: "verifying", hash: "test-hash" }); return true; });
  assert.equal(state.phase, "confirmed");
  assert.equal(state.hash, "test-hash");
  await assert.rejects(transaction.run(async () => { throw new walletSession.WalletSessionError('Reconnect before signing'); }));
  assert.equal(state.phase, 'not-submitted');
  for (const [message, expected] of [["No confirmation returned", "unconfirmed"], ["User rejected", "rejected"], ["The deposit failed on NEAR", "failed"]]) {
    await assert.rejects(transaction.run(async () => { throw new Error(message); }));
    assert.equal(state.phase, expected);
    assert.equal(state.hash, undefined);
  }
  let release;
  const pending = transaction.run(() => new Promise((resolve) => { release = resolve; }));
  await assert.rejects(transaction.run(async () => true), /already in progress/);
  release(true);
  await pending;
  console.log("PASS: v10 actions, exact deposits, signer protection, progress/hash, callback results, failed receipts, missing outcomes, rejection states, and concurrent-submit lock. No network transactions sent.");
})().catch((error) => { console.error(error); process.exitCode = 1; });
