// Receipt evidence and React rendering only. Never signs or submits a transaction.
const fs = require("node:fs"), ts = require("typescript"), vm = require("node:vm"), React = require("react"), assert = require("node:assert/strict");
const { renderToStaticMarkup } = require("react-dom/server");
function load(file, overrides = {}) {
  const api = {}, code = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  vm.runInNewContext(code, { exports: api, atob, require: (id) => id in overrides ? overrides[id] : require(id) });
  return api;
}
const near = { ZINC_CONTRACT_ID: "zinc.testnet" };
const verify = load("src/lib/verify-transaction.ts", { "./near": near });
const helper = load("src/lib/claim-receipt.ts", { "./near": near, "./verify-transaction": verify });
const signer = "alice.testnet", hash = "A".repeat(44), amount = "2500000000000000000000001";
function fixture(value = amount) {
  return { transaction: { receiver_id: near.ZINC_CONTRACT_ID, signer_id: signer, hash }, status: { SuccessValue: btoa("true") },
    transaction_outcome: { outcome: { status: { SuccessReceiptId: "start" } } },
    receipts: [{ receipt_id: "payout", predecessor_id: near.ZINC_CONTRACT_ID, receiver_id: signer, receipt: { Action: { actions: [{ Transfer: { deposit: value } }] } } }],
    receipts_outcome: [{ id: "payout", outcome: { executor_id: signer, status: { SuccessValue: "" } } }] };
}
assert.equal(helper.successfulClaimAmount(fixture(), signer), amount);
assert.equal(helper.successfulClaimAmount(fixture("1"), signer), "1");
const duplicated = fixture(); duplicated.receipts.push(structuredClone(duplicated.receipts[0]));
assert.equal(helper.successfulClaimAmount(duplicated, signer), amount);
const refund = fixture(); const gas = structuredClone(refund.receipts[0]); gas.receipt_id = "refund"; gas.predecessor_id = "system"; refund.receipts.push(gas);
refund.receipts_outcome.push({ id: "refund", outcome: { executor_id: signer, status: { SuccessValue: "" } } });
assert.equal(helper.successfulClaimAmount(refund, signer), amount);
for (const transform of [
  (o) => { o.status.SuccessValue = btoa("false"); },
  (o) => { o.receipts_outcome[0].outcome.status = { Failure: {} }; },
  (o) => { delete o.receipts; },
  (o) => { o.receipts[0].receiver_id = "bob.testnet"; },
  (o) => { o.transaction.signer_id = "bob.testnet"; },
  (o) => { o.transaction.receiver_id = "other.testnet"; },
  (o) => { o.receipts_outcome[0].outcome.executor_id = "other.testnet"; },
  (o) => { o.receipts_outcome[0].id = "unrelated"; },
  (o) => { o.receipts[0].receipt.Action.actions[0].Transfer.deposit = "0.1"; },
]) { const o = fixture(); transform(o); assert.equal(helper.successfulClaimAmount(o, signer), null); }
(async () => {
  const nearApi = await import("near-api-js");
  const component = load("src/components/campaigns/ClaimReceipt.tsx", { "next/link": { __esModule: true, default: ({ href, children }) => React.createElement("a", { href }, children) }, "near-api-js": nearApi, "../../lib/zinc-activity": {} });
  const receipt = { campaignId: 6, accountId: signer, hash, amountYocto: amount };
  const render = (overrides = {}) => renderToStaticMarkup(React.createElement(component.ClaimReceiptView, { receipt, loading: false, unavailable: false, onRefresh() {}, ...overrides }));
  let html = render();
  assert.ok(html.includes("2.500000000000000000000001 NEAR")); assert.ok(html.includes(signer));
  assert.ok(html.includes(`/txns/${hash}`)); assert.ok(html.includes('href="/earnings"'));
  assert.ok(html.includes("several rights, retained historical revenue, or treasury earnings"));
  html = render({ receipt: { ...receipt, amountYocto: null }, unavailable: true });
  assert.ok(html.includes("Revenue payout confirmed")); assert.ok(html.includes("no amount is inferred"));
  assert.ok(html.includes("Refresh receipt amount")); assert.ok(!html.includes("2.5 NEAR"));
  html = render({ receipt: { ...receipt, amountYocto: null }, loading: true });
  assert.ok(html.includes("Reading receipt evidence")); assert.ok(html.includes("Revenue payout confirmed"));
  console.log("PASS: exact native payout including single yocto, successful callback required, failed/missing/mismatched evidence excluded, duplicate receipts and gas refunds excluded, confirmed-vs-unavailable amount states, and explorer/earnings links. No network transactions sent.");
})().catch((error) => { console.error(error); process.exitCode = 1; });
