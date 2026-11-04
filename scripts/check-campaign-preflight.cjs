// Draft validation and actual form-handler fixtures; no signing or network calls.
const fs = require("node:fs"), ts = require("typescript"), vm = require("node:vm"), React = require("react"), assert = require("node:assert/strict");
function load(file, overrides = {}, globals = {}) {
  const api = {};
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  vm.runInNewContext(code, { exports: api, ...globals, require: (id) => id in overrides ? overrides[id] : require(id) });
  return api;
}
const helper = load("src/lib/campaign-draft.ts");
const draft = { campaignName: " Music ", description: " Revenue ", startDate: "2026-11-01", endDate: "2026-11-30",
  contributors: [{ role: " Artist ", wallet: " alice.testnet ", share: 33.33 }, { role: "Developer", wallet: "b".repeat(64), share: 16.67 }], treasuryWallet: "treasury.testnet", treasuryShare: 50 };
const validate = (extra = {}) => helper.validateCampaignDraft({ ...draft, ...extra });
let result = validate();
assert.equal(result.errors.length, 0); assert.equal(result.totalBps, 10000);
assert.equal(result.input.contributors[0].shareBps, 3333); assert.equal(result.input.contributors[1].shareBps, 1667);
assert.equal(result.input.name, "Music"); assert.equal(result.input.contributors[0].accountId, "alice.testnet");
assert.equal(result.input.startTimestampMs, Date.UTC(2026, 10, 1));
for (const value of [NaN, Infinity, -1, 0, 100.01, 0.001, 33.333, 1e-8]) assert.equal(helper.percentageToBps(value), null);
assert.equal(helper.percentageToBps(0.01), 1); assert.equal(helper.percentageToBps(25), 2500);
assert.equal(helper.percentageToBps(16.67), 1667);
for (const account of ["", "a", "Alice.testnet", "a..testnet", "a-_b", "https://alice.testnet", "a".repeat(65)]) {
  assert.equal(validate({ treasuryWallet: account }).input, null);
  assert.equal(validate({ contributors: [{ ...draft.contributors[0], wallet: account, share: 50 }] }).input, null);
}
for (const dates of [{ startDate: "2026-02-30" }, { endDate: "2026-11-01" }, { endDate: "2026-10-01" }, { endDate: "not-date" }, { startDate: "1969-12-31" }]) assert.equal(validate(dates).input, null);
assert.equal(validate({ contributors: [] }).input, null);
assert.equal(validate({ treasuryShare: 49.99 }).input, null);
assert.equal(validate({ treasuryShare: 50.001 }).input, null);
assert.equal(validate({ campaignName: " " }).input, null);
assert.equal(validate({ contributors: [{ ...draft.contributors[0], role: " ", share: 50 }] }).input, null);
// Repeated contributor wallets and treasury/contributor overlap are legitimate separate rights.
assert.ok(validate({ contributors: [{ ...draft.contributors[0], wallet: "treasury.testnet", share: 50 }] }).input);

let slots = {}, cursor = 0, calls = [], release;
const hooks = { ...React, useEffect() {}, useMemo: (calculate) => calculate(),
  useState(initial) { const key = cursor++; if (!(key in slots)) slots[key] = initial; return [slots[key], (value) => { slots[key] = typeof value === "function" ? value(slots[key]) : value; }]; },
  useRef(initial) { const key = cursor++; if (!(key in slots)) slots[key] = { current: initial }; return slots[key]; } };
let wallet = { accountId: "alice.testnet", selector: {}, connect() {} };
const form = load("src/components/campaigns/CreateCampaignForm.tsx", {
  react: hooks, "../wallet/WalletProvider": { useWallet: () => wallet }, "../../lib/campaign-draft": helper,
  "../../lib/zinc-write": { createCampaignOnNear: async (_selector, input) => { calls.push(input); await new Promise((resolve) => { release = resolve; }); return { status: { SuccessValue: "" }, transaction_outcome: { outcome: { status: {} } }, receipts_outcome: [] }; } },
  "./CampaignRightsPreview": { default: () => null }, "./CampaignCreated": { default: () => null },
  "../../lib/campaign-confirmation": { campaignConfirmation: () => ({ campaignId: 7, hash: null }) },
  "../transactions/TransactionProgress": { default: () => null, useTransactionProgress: () => ({ progress: null, run: (action) => action(() => {}) }) },
}, { window: { scrollTo() {}, localStorage: { removeItem() {} } } });
function render() { cursor = 0; return form.default(); }
function findAll(node, predicate, found = []) {
  if (!React.isValidElement(node)) return found;
  if (predicate(node)) found.push(node);
  React.Children.toArray(node.props.children).forEach((child) => findAll(child, predicate, found));
  return found;
}
const inputs = () => findAll(render(), (node) => node.type === "input");
const change = (node, value) => node.props.onChange({ target: { value } });
const byPlaceholder = (placeholder) => inputs().find((node) => node.props.placeholder === placeholder);
function populate() {
  change(byPlaceholder("AlphaCats Launch"), "Music");
  change(findAll(render(), (node) => node.type === "textarea")[0], "Revenue");
  change(inputs().filter((node) => node.props.type === "date")[0], "2026-11-01");
  change(inputs().filter((node) => node.props.type === "date")[1], "2026-11-30");
  inputs().filter((node) => node.props.placeholder === "contributor.testnet").forEach((node, i) => change(node, `person${i}.testnet`));
  change(byPlaceholder("project.testnet"), "treasury.testnet");
}
(async () => {
  populate();
  const shareInputs = inputs().filter((node) => node.props.type === "number");
  [33.33, 16.67, 10, 40].forEach((share, i) => change(shareInputs[i], String(share)));
  assert.ok(shareInputs.every((node) => node.props.step === "0.01"));
  change(byPlaceholder("project.testnet"), "BAD ACCOUNT");
  render().props.onSubmit({ preventDefault() {} }); assert.equal(typeof render().props.onCreate, "undefined"); assert.equal(calls.length, 0);
  change(byPlaceholder("project.testnet"), "treasury.testnet");
  render().props.onSubmit({ preventDefault() {} });
  const reviewed = render(); assert.equal(reviewed.props.totalAllocation, 100);
  const first = reviewed.props.onCreate(), second = reviewed.props.onCreate();
  assert.equal(calls.length, 1); assert.equal(calls[0].contributors[0].shareBps, 3333); assert.equal(calls[0].contributors[1].shareBps, 1667);
  assert.equal(calls[0].treasuryShareBps, 4000); assert.equal(calls[0].startTimestampMs, Date.UTC(2026, 10, 1));
  release(); await Promise.all([first, second]);
  console.log("PASS: exact basis-point preflight, valid totals, account syntax, invalid/UTC dates, overlapping recipients, actual review payload and duplicate-submit guard. No network transactions sent.");
})().catch((error) => { console.error(error); process.exitCode = 1; });
