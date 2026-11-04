// Dashboard action models and real React rendering. No RPC calls or transactions.
const fs = require("node:fs"), ts = require("typescript"), vm = require("node:vm"), React = require("react"), assert = require("node:assert/strict");
const { renderToStaticMarkup } = require("react-dom/server");
function load(file, overrides = {}) {
  const api = {}, code = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  vm.runInNewContext(code, { exports: api, require: (id) => id in overrides ? overrides[id] : require(id) }); return api;
}
const model = load("src/lib/dashboard-claims.ts"), big = "900719925474099312345678901234";
const campaigns = Array.from({ length: 5 }, (_, id) => ({ id, name: id === 0 ? "Ended historical campaign" : `Project ${id}`, end_timestamp_ms: id === 0 ? 1 : 9999 }));
const summary = model.summarizeDashboardClaims(campaigns, ["1", big, (BigInt(big) + 1n).toString(), "0", "2"]);
assert.equal(summary.amount, BigInt(big) * 2n + 4n);
assert.equal(summary.ready[0].campaignId, 2); assert.equal(summary.ready[1].campaignId, 1);
assert.ok(summary.ready.some((row) => row.campaignId === 0), "Ended-campaign historical earnings must remain actionable");
assert.equal(summary.ready.length, 4);
assert.throws(() => model.summarizeDashboardClaims(campaigns, ["1"]), /Incomplete/);
assert.throws(() => model.summarizeDashboardClaims([campaigns[0], campaigns[0]], ["1", "1"]), /Incomplete/);
assert.throws(() => model.summarizeDashboardClaims(campaigns, ["1", "0.1", "0", "0", "0"]), /Invalid/);
assert.equal(model.summarizeDashboardClaims([], []).amount, 0n);
(async () => {
  const near = await import("near-api-js");
  const component = load("src/components/dashboard/DashboardActions.tsx", { "near-api-js": near, "next/link": { __esModule: true, default: ({ href, children, ...props }) => React.createElement("a", { href, ...props }, children) } });
  const props = { accountId: "alice.testnet", claims: summary.ready, claimsFailed: false, campaignFailed: false, campaignsReady: true, activeCampaign: { id: 6, name: "Music <script>unsafe</script>" }, onConnect() {} };
  const render = (extra = {}) => renderToStaticMarkup(React.createElement(component.default, { ...props, ...extra }));
  let html = render();
  assert.ok(html.includes("900719.925474099312345678901235 NEAR"));
  assert.ok(html.includes("4 campaigns have revenue ready"));
  assert.ok(html.includes('href="/campaigns/2#claim-revenue"')); assert.ok(!html.includes('href="/campaigns/0#claim-revenue"'), "Only the top three claims are previewed; Earnings links to all");
  assert.ok(html.includes('href="/earnings"')); assert.ok(html.includes('href="/nfts"')); assert.ok(html.includes('href="/pay/6"'));
  assert.ok(html.includes("platform-wide, not a count of NFTs in your wallet")); assert.ok(!html.includes("<script>"));
  html = render({ accountId: null, claims: null }); assert.ok(html.includes("Connect wallet to find your rights")); assert.ok(!html.includes("alice.testnet")); assert.ok(!html.includes("900719."));
  html = render({ claims: [] }); assert.ok(html.includes("does not mean you own no NFTs")); assert.ok(!html.includes("campaigns have revenue ready"));
  html = render({ claims: null }); assert.ok(html.includes("Reading your claimable campaign balances"));
  html = render({ claims: null, claimsFailed: true }); assert.ok(html.includes("unknown, not zero"));
  html = render({ activeCampaign: null }); assert.ok(html.includes("No campaign is currently accepting")); assert.ok(!html.includes('href="/pay/'));
  html = render({ activeCampaign: null, campaignsReady: false }); assert.ok(html.includes("Reading active campaign availability"));
  console.log("PASS: complete exact claim summary, one-yocto ordering, ended-campaign earnings, top-three actions, earnings/NFT/support links, global-vs-wallet distinction, disconnected/loading/error/zero states and escaped live names. No RPC calls or transactions sent.");
})().catch((error) => { console.error(error); process.exitCode = 1; });
