// Receipt fixtures and real SQLite. Does not submit any NEAR transactions.
const fs = require("node:fs"), ts = require("typescript"), vm = require("node:vm"), assert = require("node:assert/strict");
const compile = (file) => ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const appOrigin = {}, originEnv = {};
vm.runInNewContext(compile("src/lib/server/app-origin.ts"), { exports: appOrigin, URL, process: { env: originEnv }, require: () => ({}) });
const near = { NEAR_NETWORK_ID: "testnet", ZINC_CONTRACT_ID: "zinc.testnet", NEAR_RPC_URL: "https://rpc.example" };
const verify = {}, verifier = {}, store = {};
vm.runInNewContext(compile("src/lib/verify-transaction.ts"), { exports: verify, atob, require: () => near });
const amounts = {};
vm.runInNewContext(compile("src/lib/claim-receipt.ts"), { exports: amounts, atob, require: (id) => id === "./near" ? near : verify });
vm.runInNewContext(compile("src/lib/server/activity-store.ts"), { exports: store, Date, process: { env: { ZINC_ACTIVITY_DB: ":memory:" } },
  require: (id) => id === "server-only" ? {} : id === "../near" ? near : require(id) });
const hash = "A".repeat(44), signer = "alice.testnet";
const encoded = (value) => Buffer.from(JSON.stringify(value)).toString("base64");
const success = { SuccessValue: "" };
const event = (name, data) => `EVENT_JSON:${JSON.stringify({ standard: "nep171", version: "1.0.0", event: name, data: [data] })}`;
function fixture(method, args, result = {}, deposit = "0") {
  return { final_execution_status: "FINAL", transaction: { hash, signer_id: signer, receiver_id: near.ZINC_CONTRACT_ID,
    actions: [{ FunctionCall: { method_name: method, args: encoded(args), deposit } }] },
    status: { SuccessValue: encoded(result) }, transaction_outcome: { block_hash: "block", outcome: { status: { SuccessReceiptId: "receipt" } } },
    receipts_outcome: [{ id: "receipt", outcome: { executor_id: near.ZINC_CONTRACT_ID, status: success, logs: [] } }] };
}
let outcome, calls = 0;
vm.runInNewContext(compile("src/lib/server/activity-verifier.ts"), { exports: verifier, Buffer, AbortSignal, atob,
  fetch: async (_url, options) => { calls++; const request = JSON.parse(options.body); return { ok: true, json: async () => ({ result: request.method === "block" ? { header: { timestamp_nanosec: "1760000000123456789" } } : structuredClone(outcome) }) }; },
  require: (id) => id === "server-only" ? {} : id === "../near" ? near : id === "../verify-transaction" ? verify : id === "../claim-receipt" ? amounts : require(id) });
(async () => {
  assert.ok(verifier.validActivityInput(hash, signer));
  assert.equal(verifier.validActivityInput("invalid", signer), false);
  assert.equal(verifier.validActivityInput(hash, "invalid account"), false);
  outcome = fixture("deposit_revenue", { campaign_id: 6 }, {}, "100000000000000000000001");
  let rows = await verifier.verifyActivityTransaction(hash, signer);
  assert.equal(rows[0].amountYocto, "100000000000000000000001");
  assert.equal(rows[0].timestampMs, 1760000000123);
  store.saveActivityTransaction(hash, signer, rows); store.saveActivityTransaction(hash, signer, rows);
  assert.equal(store.readSharedActivity(6).length, 1);
  assert.equal(store.readSharedActivity(7).length, 0);
  assert.ok(store.hasActivityTransaction(hash, signer));
  assert.equal(store.hasActivityTransaction(hash, "bob.testnet"), false);
  outcome.final_execution_status = "EXECUTED_OPTIMISTIC";
  await assert.rejects(verifier.verifyActivityTransaction(hash, signer));
  outcome.final_execution_status = "FINAL";
  outcome.receipts_outcome[0].outcome.status = { Failure: {} };
  await assert.rejects(verifier.verifyActivityTransaction(hash, signer));
  outcome = fixture("deposit_revenue", { campaign_id: 6 }, {}, "1"); outcome.transaction.receiver_id = "evil.testnet";
  await assert.rejects(verifier.verifyActivityTransaction(hash, signer), /Zinc contract/);
  outcome = fixture("claim_revenue", { campaign_id: 6 }, false);
  await assert.rejects(verifier.verifyActivityTransaction(hash, signer), /callback/);
  outcome = fixture("claim_revenue", { campaign_id: 6 }, true);
  assert.equal((await verifier.verifyActivityTransaction(hash, signer))[0].amountYocto, undefined);
  outcome.receipts = [{ receipt_id: "payout", predecessor_id: near.ZINC_CONTRACT_ID, receiver_id: signer, receipt: { Action: { actions: [{ Transfer: { deposit: "6000000000000000000000" } }] } } },
    { receipt_id: "refund", predecessor_id: "system", receiver_id: signer, receipt: { Action: { actions: [{ Transfer: { deposit: "999" } }] } } }];
  outcome.receipts_outcome.push({ id: "payout", outcome: { executor_id: signer, status: success, logs: [] } }, { id: "refund", outcome: { executor_id: signer, status: success, logs: [] } });
  assert.equal((await verifier.verifyActivityTransaction(hash, signer))[0].amountYocto, "6000000000000000000000");
  outcome = fixture("nft_transfer", { receiver_id: "bob.testnet", token_id: "campaign:6:right:0" });
  outcome.receipts_outcome[0].outcome.logs = [event("nft_transfer", { old_owner_id: signer, new_owner_id: "bob.testnet", token_ids: ["campaign:6:right:0"] })];
  rows = await verifier.verifyActivityTransaction(hash, signer);
  assert.equal(rows[0].from, signer); assert.equal(rows[0].to, "bob.testnet"); assert.equal(rows[0].campaignId, 6);
  store.saveActivityTransaction(hash, signer, rows);
  assert.equal(store.readSharedActivity(undefined, "campaign:6:right:0").length, 1);
  assert.equal(store.readSharedActivity(undefined, undefined, "bob.testnet").length, 1);
  assert.equal(store.readSharedActivity(undefined, undefined, signer).length, 1, "Owner filtering must exclude the deposit record");
  assert.equal(store.readSharedActivity(undefined, undefined, "unrelated.testnet").length, 0);
  outcome.receipts_outcome[0].outcome.executor_id = "evil.testnet";
  await assert.rejects(verifier.verifyActivityTransaction(hash, signer), /No supported/);
  outcome = fixture("create_campaign", {}, { id: 7 });
  outcome.receipts_outcome[0].outcome.logs = [event("nft_mint", { owner_id: signer, token_ids: ["campaign:7:right:0", "campaign:7:right:1"] })];
  rows = await verifier.verifyActivityTransaction(hash, signer);
  assert.equal(rows.length, 3); assert.equal(rows[0].campaignId, 7); assert.equal(rows[1].kind, "NFT Mints");
  assert.notEqual(rows[1].id, rows[2].id);
  const next = require("next/server"), routes = {};
  vm.runInNewContext(compile("src/app/api/activity/route.ts"), { exports: routes, Buffer, Response,
    require: (id) => id.endsWith("app-origin") ? appOrigin : id.endsWith("activity-store") ? store : id.endsWith("activity-verifier") ? verifier : require(id) });
  const request = (input, origin = "https://zinc.example") => new next.NextRequest("https://zinc.example/api/activity", { method: "POST", headers: { origin }, body: JSON.stringify(input) });
  assert.equal((await routes.POST(request({ hash, signer }, "https://evil.example"))).status, 403);
  assert.equal((await routes.POST(request({ hash: "invalid", signer }))).status, 400);
  assert.equal((await routes.POST(request({ hash, signer, payload: "x".repeat(2048) }))).status, 400);
  const previous = calls;
  assert.equal((await routes.POST(request({ hash, signer }))).status, 200);
  assert.equal(calls, previous, "A known transaction must not make more RPC calls");
  const response = await routes.GET(new next.NextRequest("https://zinc.example/api/activity?campaign=6"));
  assert.equal((await response.json()).rows.length, 2);
  assert.equal((await routes.GET(new next.NextRequest("https://zinc.example/api/activity?campaign=-1"))).status, 400);
  const ownResponse = await routes.GET(new next.NextRequest("https://zinc.example/api/activity?owner=bob.testnet"));
  assert.equal((await ownResponse.json()).rows.length, 1);
  assert.equal((await routes.GET(new next.NextRequest("https://zinc.example/api/activity?owner=invalid%20account"))).status, 400);
  const activity = {}, browser = new Map(); let invalidated = 0, submitted;
  vm.runInNewContext(compile("src/lib/zinc-activity.ts"), { exports: activity, AbortSignal, URLSearchParams, Event,
    window: { dispatchEvent() {} }, localStorage: { getItem: (key) => browser.get(key) ?? null, setItem: (key, value) => browser.set(key, value) },
    fetch: async (_url, options) => { submitted = JSON.parse(options.body); throw new Error("Shared server offline"); },
    require: (id) => id === "./near" ? near : { invalidateReadCache: () => invalidated++ } });
  activity.recordConfirmedActivity(fixture("deposit_revenue", { campaign_id: 6 }, {}, "1"), { kind: "Deposits", campaignId: 6, amountYocto: "1" });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(invalidated, 1);
  assert.deepEqual(submitted, { hash, signer });
  assert.equal(activity.readRecordedActivity()[0].amountYocto, "1", "Server outage must retain the local confirmation");
  for (let i = 0; i < 30; i++) assert.ok(store.takeActivityBudget());
  assert.equal(store.takeActivityBudget(), false);
  originEnv.ZINC_PUBLIC_ORIGIN = "https://zinc.example";
  const proxyRequest = (origin) => new next.NextRequest("http://localhost:8080/api/activity", { method: "POST", headers: { origin }, body: JSON.stringify({hash, signer}) });
  assert.equal((await routes.POST(proxyRequest("https://zinc.example"))).status, 200);
  assert.equal((await routes.POST(proxyRequest("https://evil.example"))).status, 403);
  console.log("Shared activity checks passed: exact deposits, final receipts, payout callback/amount, trusted NFT events, SQLite dedup/filtering, origin/input limits, cached imports, RPC budget.");
})().catch((error) => { console.error(error); process.exitCode = 1; });
