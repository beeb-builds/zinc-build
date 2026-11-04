// Exact balances, React markup and async hook fixtures; never signs or sends transactions.
const fs = require("node:fs"), ts = require("typescript"), vm = require("node:vm"), React = require("react"), assert = require("node:assert/strict");
const { renderToStaticMarkup } = require("react-dom/server");
function load(overrides) {
  const api = {}, code = ts.transpileModule(fs.readFileSync("src/components/nfts/TransferEarningsPreview.tsx", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  vm.runInNewContext(code, { exports: api, require: (id) => id in overrides ? overrides[id] : require(id) });
  return api;
}
(async () => {
  const near = await import("near-api-js");
  const link = { __esModule: true, default: ({ href, children, ...props }) => React.createElement("a", { href, ...props }, children) };
  let reads = [], implementation = async (kind) => kind === "claimable" ? "100000000000000000000001" : "200000000000000000000002";
  const rpc = Object.fromEntries(["Claimable", "Claimed"].map((name) => [`get${name}`, (id, account) => { reads.push({ name, id, account }); return implementation(name.toLowerCase(), id, account); }]));
  const api = load({ "near-api-js": near, "next/link": link, "../../lib/zinc-contract": rpc });
  let balances = await api.readTransferEarnings(6, "alice.testnet");
  assert.equal(reads.length, 2); assert.ok(reads.every((read) => read.id === 6 && read.account === "alice.testnet"));
  const props = { campaignId: 6, accountId: "alice.testnet", status: "ready", balances, busy: false, onRetry() {} };
  const render = (extra = {}) => renderToStaticMarkup(React.createElement(api.TransferEarningsView, { ...props, ...extra }));
  let html = render();
  assert.ok(html.includes("0.100000000000000000000001 NEAR")); assert.ok(html.includes("0.200000000000000000000002 NEAR"));
  assert.ok(html.includes("campaign-wide totals")); assert.ok(html.includes("not a balance stored in this NFT"));
  assert.ok(html.includes("do not need to claim first")); assert.ok(html.includes('href="/campaigns/6#claim-revenue"'));
  assert.ok(!html.includes("Confirm in wallet"));
  html = render({ balances: { claimable: "0", claimed: "0" } }); assert.equal((html.match(/0 NEAR/g) ?? []).length, 2);
  html = render({ status: "loading", balances: null }); assert.ok(html.includes('role="status"')); assert.ok(!html.includes("0 NEAR"));
  html = render({ status: "error", balances: null, busy: true }); assert.ok(html.includes('role="alert"')); assert.ok(html.includes("unavailable, not zero")); assert.ok(html.includes('disabled=""')); assert.ok(!html.includes("0 NEAR"));
  for (const invalid of ["-1", "1.5", "NaN", "", 1, null]) {
    implementation = async (kind) => kind === "claimed" ? invalid : "100";
    await assert.rejects(api.readTransferEarnings(6, "alice.testnet"), /invalid earnings/);
  }
  implementation = async (kind) => { if (kind === "claimed") throw new Error("RPC unavailable"); return "100"; };
  await assert.rejects(api.readTransferEarnings(6, "alice.testnet"), /RPC unavailable/);

  let slots = {}, cursor, effect;
  const hooks = { ...React, useEffect(callback) { effect = callback; }, useState(initial) { const key = cursor++; if (!(key in slots)) slots[key] = initial; return [slots[key], (value) => { slots[key] = typeof value === "function" ? value(slots[key]) : value; }]; } };
  const preview = load({ react: hooks, "near-api-js": near, "next/link": link, "../../lib/zinc-contract": rpc });
  function component(accountId = "alice.testnet", campaignId = 6) { cursor = 0; return preview.default({ accountId, campaignId, busy: false }); }
  const tick = () => new Promise(setImmediate);
  let release;
  implementation = (kind) => kind === "claimed" ? Promise.resolve("10") : new Promise((resolve) => { release = resolve; });
  assert.equal(component().props.status, "loading"); const cancel = effect();
  cancel(); release("999"); await tick(); assert.equal(component().props.status, "loading", "A canceled request must never publish balances");
  implementation = async () => "12"; effect(); await tick(); assert.equal(component().props.status, "ready");
  assert.equal(component("bob.testnet").props.status, "loading", "Old account balances must be hidden before the new effect runs");
  assert.equal(component("alice.testnet", 7).props.status, "loading", "Old campaign balances must not flash for a different campaign");
  component(); implementation = async () => { throw new Error("offline"); }; effect(); await tick();
  let view = component(); assert.equal(view.props.status, "error"); assert.equal(view.props.balances, null);
  view.props.onRetry(); assert.equal(component().props.status, "loading");
  implementation = async () => "0"; effect(); await tick(); assert.equal(component().props.status, "ready");
  assert.equal(component().props.balances.claimable, "0");
  console.log("PASS: exact yocto balances, zero vs unavailable, campaign-wide labels, claim links, malformed/partial RPC failures, late request cancellation, account/campaign isolation and retry. No network transactions sent.");
})().catch((error) => { console.error(error); process.exitCode = 1; });
