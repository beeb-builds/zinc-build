// Server page fixtures, React markup and read-refresh handlers. No network or wallet writes.
const fs = require("node:fs"), ts = require("typescript"), vm = require("node:vm"), React = require("react"), assert = require("node:assert/strict");
const { renderToStaticMarkup } = require("react-dom/server");
function load(file, overrides = {}, globals = {}) {
  const api = {}, code = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  vm.runInNewContext(code, { exports: api, ...globals, require: (id) => id in overrides ? overrides[id] : require(id) });
  return api;
}
function find(node, predicate) {
  if (!React.isValidElement(node)) return;
  if (predicate(node)) return node;
  for (const child of React.Children.toArray(node.props.children)) { const match = find(child, predicate); if (match) return match; }
}
const component = (name) => ({ __esModule: true, default: ({ children }) => React.createElement("div", { "data-component": name }, children) });
const campaign = { id: 6, creator: "creator.testnet", name: "Music", description: "Revenue agreement", start_timestamp_ms: 1000, end_timestamp_ms: 2000,
  created_at_ms: 0, total_deposited_yocto: "1000000000000000000000001", contributors: [{ role: "Artist", account_id: "alice.testnet", share_bps: 6000 }], treasury_account: "treasury.testnet", treasury_share_bps: 4000 };
let response = campaign, readError = false, reads = 0;
const validation = load("src/lib/campaign-discovery.ts");
const page = load("src/app/campaigns/[id]/page.tsx", {
  "next/link": { __esModule: true, default: ({ href, children, ...props }) => React.createElement("a", { href, ...props }, children) },
  "next/server": { connection: async () => {} },
  "../../../components/layout/DashboardShell": component("shell"),
  "../../../components/campaigns/DepositRevenueForm": component("deposit"),
  "../../../components/campaigns/ClaimRevenueSection": component("claims"),
  "../../../components/campaigns/RevenueRightsSection": component("rights"),
  "../../../components/activity/ActivityFeed": component("activity"),
  "../../../components/campaigns/CampaignPaymentLink": component("payment-link"),
  "../../../components/campaigns/CampaignRefreshButton": { __esModule: true, default: ({ retry }) => React.createElement("button", null, retry ? "Retry campaign read" : "Refresh campaign data") },
  "../../../components/campaigns/CampaignStatusBadge": { __esModule: true, default: ({ initialStatus }) => React.createElement("span", null, initialStatus) },
  "../../../lib/zinc-contract": { getCampaign: async (id) => { reads++; assert.equal(id, 6); if (readError) throw new Error("RPC offline"); return response; } },
  "../../../lib/campaign-discovery": validation,
}, { console: { error() {} } });
async function renderPage(id = "6") {
  const tree = page.default({ params: Promise.resolve({ id }) });
  const details = find(tree, (node) => typeof node.type === "function" && node.type.name === "CampaignDetails");
  assert.ok(details); return renderToStaticMarkup(await details.type(details.props));
}
(async () => {
  let html = await renderPage();
  assert.ok(html.includes("1.000000000000000000000001 NEAR")); assert.ok(html.includes("Refresh campaign data"));
  for (const name of ["deposit", "claims", "rights", "activity", "payment-link"]) assert.ok(html.includes(`data-component="${name}"`));
  readError = true; html = await renderPage();
  assert.ok(html.includes("Retry campaign read")); assert.ok(html.includes("does not mean the campaign is missing"));
  assert.ok(!html.includes('data-component="deposit"')); assert.ok(!html.includes('data-component="claims"'));
  readError = false;
  for (const bad of [{ ...campaign, id: 7 }, { ...campaign, treasury_account: undefined }, { ...campaign, treasury_share_bps: 3999 }, { ...campaign, total_deposited_yocto: undefined }, { ...campaign, total_deposited_yocto: "1.5" }, { ...campaign, start_timestamp_ms: NaN }]) {
    response = bad; html = await renderPage(); assert.ok(html.includes("Retry campaign read")); assert.ok(!html.includes('data-component="deposit"'));
    assert.ok(!html.includes("Unavailable until contract upgrade"));
  }
  response = null; html = await renderPage(); assert.ok(html.includes("Campaign not found")); assert.ok(!html.includes("Retry campaign read"));
  const before = reads; html = await renderPage("not-an-id"); assert.equal(reads, before); assert.ok(html.includes("not valid"));

  let slots = {}, cursor, pending = false, activeWrite = false, refreshed = 0, invalidated = 0;
  const hooks = { ...React,
    useState(initial) { const key = cursor++; if (!(key in slots)) slots[key] = initial; return [slots[key], (value) => { slots[key] = value; }]; },
    useTransition: () => [pending, (action) => action()],
  };
  const button = load("src/components/campaigns/CampaignRefreshButton.tsx", {
    react: hooks, "next/navigation": { useRouter: () => ({ refresh() { refreshed++; } }) },
    "../../lib/read-scheduler": { invalidateReadCache() { invalidated++; }, isBrowserWriteActive: () => activeWrite },
  });
  function renderButton(retry = false) { cursor = 0; return button.default({ retry }); }
  function click() { find(renderButton(), (node) => node.type === "button").props.onClick(); }
  activeWrite = true; click(); assert.equal(refreshed, 0); assert.equal(invalidated, 0);
  html = renderToStaticMarkup(renderButton()); assert.ok(html.includes("Finish the current wallet transaction"));
  activeWrite = false; click(); assert.equal(refreshed, 1); assert.equal(invalidated, 1);
  html = renderToStaticMarkup(renderButton()); assert.ok(!html.includes("Finish the current wallet transaction"));
  pending = true; click(); assert.equal(refreshed, 1); html = renderToStaticMarkup(renderButton());
  assert.ok(html.includes('disabled=""')); assert.ok(html.includes('role="status"')); assert.ok(html.includes("No transaction is submitted"));
  pending = false; html = renderToStaticMarkup(renderButton(true)); assert.ok(html.includes("Retry campaign read"));
  console.log("PASS: exact deposited totals, complete campaign controls, missing vs failed reads, mismatched/malformed campaign rejection, invalid route IDs, retry feedback, cache invalidation and active-write refresh protection. No network or wallet transactions.");
})().catch((error) => { console.error(error); process.exitCode = 1; });
