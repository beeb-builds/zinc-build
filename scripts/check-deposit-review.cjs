// Evidence, React markup, and form-handler fixtures. No wallet or network writes.
const fs = require("node:fs"), ts = require("typescript"), vm = require("node:vm"), React = require("react"), assert = require("node:assert/strict");
const { renderToStaticMarkup } = require("react-dom/server");
function load(file, overrides = {}, globals = {}) {
  const api = {}, code = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  vm.runInNewContext(code, { exports: api, atob, TextDecoder, Uint8Array, ...globals, require: (id) => id in overrides ? overrides[id] : require(id) });
  return api;
}
const config = { ZINC_CONTRACT_ID: "zinc.testnet" }, signer = "alice.testnet", hash = "A".repeat(44), amount = "100000000000000000000001";
const verify = load("src/lib/verify-transaction.ts", { "./near": config });
const evidence = load("src/lib/deposit-receipt.ts", { "./near": config, "./verify-transaction": verify });
function fixture() { return { transaction: { signer_id: signer, receiver_id: config.ZINC_CONTRACT_ID, hash,
  actions: [{ FunctionCall: { method_name: "deposit_revenue", deposit: amount, args: Buffer.from(JSON.stringify({ campaign_id: 6 })).toString("base64") } }] },
  status: { SuccessValue: "" }, transaction_outcome: { outcome: { status: { SuccessReceiptId: "receipt" } } }, receipts_outcome: [{ outcome: { status: { SuccessValue: "" } } }] }; }
assert.equal(evidence.successfulDepositAmount(fixture(), 6, signer, amount), amount);
for (const change of [
  (o) => { o.transaction.signer_id = "bob.testnet"; },
  (o) => { o.transaction.receiver_id = "other.testnet"; },
  (o) => { o.transaction.actions[0].FunctionCall.method_name = "claim_revenue"; },
  (o) => { o.transaction.actions[0].FunctionCall.deposit = "1"; },
  (o) => { o.transaction.actions[0].FunctionCall.args = Buffer.from('{"campaign_id":7}').toString("base64"); },
  (o) => { o.receipts_outcome[0].outcome.status = { Failure: {} }; },
  (o) => { delete o.transaction.actions; },
]) { const o = fixture(); change(o); assert.equal(evidence.successfulDepositAmount(o, 6, signer, amount), null); }
assert.equal(evidence.successfulDepositAmount(null, 6, signer, amount), null);
(async () => {
  const near = await import("near-api-js");
  const review = load("src/components/campaigns/DepositReview.tsx", { "near-api-js": near, "../../lib/near": config });
  const receipt = load("src/components/campaigns/DepositReceipt.tsx", { "near-api-js": near, "next/link": { __esModule: true, default: ({ href, children }) => React.createElement("a", { href }, children) } });
  let html = renderToStaticMarkup(React.createElement(review.default, { review: { accountId: signer, amountYocto: amount }, campaignId: 6, support: true, active: true, busy: false, onBack() {}, onConfirm() {} }));
  assert.ok(html.includes("0.100000000000000000000001 NEAR")); assert.ok(html.includes(signer)); assert.ok(html.includes(config.ZINC_CONTRACT_ID));
  assert.ok(html.includes("does not buy an NFT")); assert.ok(html.includes("ownership when the deposit executes")); assert.ok(html.includes("Confirm in wallet"));
  html = renderToStaticMarkup(React.createElement(receipt.default, { receipt: { campaignId: 6, accountId: signer, hash, amountYocto: amount }, support: true }));
  assert.ok(html.includes("Support payment confirmed")); assert.ok(html.includes(`/txns/${hash}`)); assert.ok(html.includes('href="/campaigns/6"')); assert.ok(html.includes("Do not repeat the payment"));
  html = renderToStaticMarkup(React.createElement(receipt.default, { receipt: { campaignId: 6, accountId: signer, hash, amountYocto: null }, support: false }));
  assert.ok(html.includes("Revenue deposit confirmed")); assert.ok(html.includes("Amount evidence unavailable")); assert.ok(!html.includes("0.1 NEAR"));
  const writes = load("src/lib/zinc-write.ts", { "@near-wallet-selector/core": {}, "near-api-js": near, "./near": config, "./zinc-activity": {}, "./transaction-progress": {}, "./transaction-journal": {}, "./verify-transaction": {}, "./read-scheduler": {}, "./wallet-session": {} });
  let slots, index, wallet, calls, clock, reject;
  const hooks = { ...React, useState(initial) { const key = index++; if (!(key in slots)) slots[key] = typeof initial === "function" ? initial() : initial; return [slots[key], (value) => { slots[key] = typeof value === "function" ? value(slots[key]) : value; }]; },
    useRef(initial) { const key = index++; if (!(key in slots)) slots[key] = { current: initial }; return slots[key]; }, useEffect() {}, useTransition: () => [false, (callback) => callback()] };
  class Clock extends Date { static now() { return clock; } }
  const progressMarker = () => null;
  const form = load("src/components/campaigns/DepositRevenueForm.tsx", {
    react: hooks, "next/navigation": { useRouter: () => ({ refresh() {} }) }, "../wallet/WalletProvider": { useWallet: () => wallet },
    "../../lib/zinc-write": { ...writes, depositRevenueOnNear: async (_selector, campaignId, entered) => { calls.push({ campaignId, entered }); if (reject) throw new Error("User rejected"); const o = fixture(); o.transaction.actions[0].FunctionCall.deposit = writes.parseDepositAmount(entered).toString(); return o; } },
    "../transactions/TransactionProgress": { __esModule: true, default: progressMarker, useTransactionProgress: () => ({ progress: { phase: "confirmed" }, run: (action) => action(() => {}) }) },
    "./DepositReview": review, "./DepositReceipt": receipt, "../../lib/deposit-receipt": evidence, "../../lib/transaction-journal": { validTransactionHash: () => true },
    "./useCampaignStatus": { useCampaignStatus: (start, end) => ({ status: clock < start ? "Scheduled" : clock > end ? "Ended" : "Active", recheck() {} }) },
  }, { Date: Clock });
  function reset() { slots = {}; calls = []; clock = 1500; reject = false; wallet = { accountId: signer, selector: { store: { getState: () => ({ accounts: [{ active: true, accountId: wallet.accountId }] }) } }, connect() {} }; }
  function render() { index = 0; return form.default({ campaignId: 6, startTimestampMs: 1000, endTimestampMs: 2000, initiallyActive: true }); }
  function find(node, type) { if (!React.isValidElement(node)) return; if (node.type === type) return node; for (const child of React.Children.toArray(node.props.children)) { const result = find(child, type); if (result) return result; } }
  function prepare() { find(render(), "input").props.onChange({ target: { value: "0.1" } }); find(render(), "form").props.onSubmit({ preventDefault() {} }); return find(render(), review.default); }
  reset(); let reviewed = prepare(); assert.ok(reviewed); assert.equal(calls.length, 0, "Reviewing must not open a wallet");
  assert.equal(find(render(), progressMarker), undefined, "A previous confirmation must not label an unsigned review as confirmed");
  reviewed.props.onConfirm(); reviewed.props.onConfirm(); await new Promise(setImmediate);
  assert.equal(calls.length, 1, "Double confirmation must submit once"); assert.equal(calls[0].entered, "0.1"); assert.ok(find(render(), receipt.default));
  reset(); reviewed = prepare(); wallet.accountId = "bob.testnet"; reviewed.props.onConfirm(); await new Promise(setImmediate); assert.equal(calls.length, 0);
  reset(); reviewed = prepare(); clock = 2001; reviewed.props.onConfirm(); await new Promise(setImmediate); assert.equal(calls.length, 0);
  reset(); reviewed = prepare(); reject = true; reviewed.props.onConfirm(); await new Promise(setImmediate); assert.equal(calls.length, 1); assert.equal(find(render(), receipt.default), undefined);
  console.log("PASS: exact deposit evidence, missing/failed/mismatched outcomes, review-before-wallet, duplicate-submit lock, changed account, expired campaign, rejected signing, receipt links and honest unknown amounts. Handler fixtures only; no network transactions sent.");
})().catch((error) => { console.error(error); process.exitCode = 1; });
