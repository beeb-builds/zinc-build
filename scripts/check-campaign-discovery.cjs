// Discovery, server boundaries and real React rendering. No chain transactions.
const fs = require("node:fs"), ts = require("typescript"), vm = require("node:vm"), React = require("react"), assert = require("node:assert/strict");
const { renderToStaticMarkup } = require("react-dom/server");
function load(file, overrides) {
  const api = {}, code = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  vm.runInNewContext(code, { exports: api, require: (id) => id in overrides ? overrides[id] : require(id) }); return api;
}
const model = load("src/lib/campaign-discovery.ts", {}), big = "900719925474099312345678901234";
const campaigns = Array.from({ length: 4 }, (_, id) => ({ id, name: id === 0 ? "Créateurs <script>Music</script>" : `Project ${id}`, description: "A real agreement", creator: id === 0 ? "alice.testnet" : "bob.testnet",
  created_at_ms: 10 + id, start_timestamp_ms: id === 1 ? 1600 : 1000, end_timestamp_ms: id === 2 ? 1499 : id === 3 ? 1600 : 2000,
  total_deposited_yocto: id === 1 ? big : id === 3 ? (BigInt(big) + 1n).toString() : "1",
  contributors: [{ role: "Artist", account_id: id === 1 ? "alice.testnet" : "other.testnet", share_bps: 6000 }], treasury_account: "treasury.testnet", treasury_share_bps: 4000 }));
const options = { query: "", status: "All", sort: "Newest", relationship: "All", accountId: null, now: 1500 };
const select = (extra) => model.discoverCampaigns(campaigns, { ...options, ...extra });
assert.equal(model.campaignStatus(campaigns[0], 999), "Scheduled");
assert.equal(model.campaignStatus(campaigns[0], 1000), "Active"); assert.equal(model.campaignStatus(campaigns[0], 2000), "Active"); assert.equal(model.campaignStatus(campaigns[0], 2001), "Ended");
const totals = model.campaignDiscoveryTotals(campaigns, 1500);
assert.equal(totals.active, 2); assert.equal(totals.revenueYocto, BigInt(big) * 2n + 3n);
assert.equal(select({ sort: "Revenue" })[0].id, 3, "Revenue differing by one yocto must sort exactly");
assert.equal(select({ sort: "Ending soon" })[0].id, 3); assert.equal(select({ sort: "Ending soon" }).at(-1).id, 2);
assert.equal(select({ query: "#001" })[0].id, 1); assert.equal(select({ query: "#99" }).length, 0);
assert.equal(select({ query: "CRÉATEURS" })[0].id, 0);
assert.equal(select({ query: "alice.testnet" }).length, 2);
assert.equal(select({ relationship: "Created by me", accountId: "alice.testnet" })[0].id, 0);
assert.equal(select({ relationship: "Original contributor", accountId: "alice.testnet" })[0].id, 1);
assert.equal(select({ relationship: "Created by me" }).length, 0);
assert.equal(select({ status: "Active" }).length, 2); assert.equal(campaigns[0].id, 0, "Sorting must not mutate source campaigns");
assert.throws(() => model.validateDiscoveryCampaigns([...campaigns, campaigns[0]]), /invalid/);
assert.throws(() => model.validateDiscoveryCampaigns([{ ...campaigns[0], total_deposited_yocto: 1 }]), /invalid/);
assert.throws(() => model.validateDiscoveryCampaigns([{ ...campaigns[0], end_timestamp_ms: -1 }]), /invalid/);
(async () => {
  const near = await import("near-api-js"), link = { __esModule: true, default: ({ href, children, ...props }) => React.createElement("a", { href, ...props }, children) };
  const overrides = { "next/link": link, "near-api-js": near, "../wallet/WalletProvider": { useWallet: () => ({ accountId: null }) }, "../data/useReadRefresh": { useReadRefresh: () => ({ version: 0, refresh() {} }) }, "../../lib/zinc-contract": {}, "../../lib/campaign-discovery": model };
  const explorer = load("src/components/campaigns/CampaignExplorer.tsx", overrides);
  let html = renderToStaticMarkup(React.createElement(explorer.CampaignDiscoveryCard, { campaign: campaigns[3], now: 1500 }));
  assert.ok(html.includes("900719.925474099312345678901235 NEAR")); assert.ok(html.includes('href="/pay/3"')); assert.ok(html.includes('href="/campaigns/3"'));
  html = renderToStaticMarkup(React.createElement(explorer.CampaignDiscoveryCard, { campaign: campaigns[2], now: 1500 })); assert.ok(!html.includes('href="/pay/'));
  html = renderToStaticMarkup(React.createElement(explorer.CampaignDiscoveryCard, { campaign: campaigns[0], now: 1500 })); assert.ok(!html.includes("<script>")); assert.ok(html.includes("&lt;script&gt;"));
  html = renderToStaticMarkup(React.createElement(explorer.default, { initialCampaigns: null, initialTime: 1500 }));
  assert.ok(html.includes("Unavailable")); assert.ok(html.includes("unavailable, not zero"));
  html = renderToStaticMarkup(React.createElement(explorer.default, { initialCampaigns: [], initialTime: 1500 })); assert.ok(html.includes("No campaigns yet"));
  let reads = 0, connected = 0, fail = false;
  const FixtureExplorer = () => null;
  const page = load("src/app/campaigns/page.tsx", { "next/link": link, "next/server": { connection: async () => { connected++; } }, "../../components/layout/DashboardShell": { __esModule: true, default: () => null }, "../../components/campaigns/CampaignExplorer": { __esModule: true, default: FixtureExplorer }, "../../lib/zinc-contract": { getCampaigns: async () => { reads++; if (fail) throw new Error("RPC unavailable"); return campaigns; } }, "../../lib/campaign-discovery": model });
  function find(node, predicate) { if (!React.isValidElement(node)) return; if (predicate(node)) return node; for (const child of React.Children.toArray(node.props.children)) { const found = find(child, predicate); if (found) return found; } }
  const shell = page.default(); assert.equal(reads, 0); assert.equal(connected, 0, "The shell must not await RPC or connection");
  const content = find(shell, (node) => typeof node.type === "function" && node.type.name === "CampaignData");
  let result = await content.type(); assert.equal(result.type, FixtureExplorer); assert.equal(result.props.initialCampaigns.length, 4); assert.equal(reads, 1);
  fail = true; result = await content.type(); assert.equal(result.props.initialCampaigns, null);
  // Component-handler fixtures ensure local controls never trigger a read by themselves.
  let slots = {}, index = 0, effects = [], version = 0, clientReads = 0;
  const hooks = { ...React, useState(initial) { const key = index++; if (!(key in slots)) slots[key] = initial; return [slots[key], (value) => { slots[key] = typeof value === "function" ? value(slots[key]) : value; }]; }, useMemo: (fn) => fn(), useEffect: (effect) => { effects.push(effect); } };
  const interactive = load("src/components/campaigns/CampaignExplorer.tsx", { ...overrides, react: hooks,
    "../data/useReadRefresh": { useReadRefresh: () => ({ version, refresh: () => version++ }) }, "../../lib/zinc-contract": { getCampaigns: async () => { clientReads++; return campaigns; } } });
  function render() { index = 0; effects = []; return interactive.default({ initialCampaigns: campaigns, initialTime: 1500 }); }
  let tree = render(); effects.at(-1)(); assert.equal(clientReads, 0, "Server snapshot must not trigger a duplicate client read");
  find(tree, (node) => node.type === "input").props.onChange({ target: { value: "music" } }); render(); effects.at(-1)(); assert.equal(clientReads, 0);
  tree = render(); find(tree, (node) => node.type === "button" && node.props.children === "Refresh campaigns").props.onClick(); render(); effects.at(-1)(); await new Promise(setImmediate); assert.equal(clientReads, 1);
  console.log("PASS: inclusive dates, one-yocto revenue ordering, exact totals, search/relationship/status filters, source immutability, live card links, empty-vs-error states, escaped content, shell streaming, local search and no duplicate initial RPC. Mock reads only; no transactions sent.");
})().catch((error) => { console.error(error); process.exitCode = 1; });
