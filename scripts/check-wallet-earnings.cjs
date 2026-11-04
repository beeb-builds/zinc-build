// Mock contract reads and real React rendering. No wallet signatures or transactions.
const fs = require("node:fs"), ts = require("typescript"), vm = require("node:vm"), React = require("react"), assert = require("node:assert/strict");
const { renderToStaticMarkup } = require("react-dom/server");
function load(file, overrides) {
  const api = {}, code = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  vm.runInNewContext(code, { exports: api, require: (id) => id in overrides ? overrides[id] : require(id) });
  return api;
}
const actor = "alice.testnet", big = "900719925474099312345678901234";
const campaigns = Array.from({ length: 5 }, (_, id) => ({ id, name: `Campaign ${id}`, created_at_ms: id * 1000,
  contributors: [{ role: "Artist", account_id: id === 0 ? actor : "other.testnet", share_bps: 6000 }], treasury_account: id === 3 ? actor : "treasury.testnet", treasury_share_bps: 4000 }));
const rights = campaigns.map((campaign) => [{ token_id: `campaign:${campaign.id}:right:0`, campaign_id: campaign.id, contributor_index: 0,
  role: "Artist", share_bps: 6000, owner_id: campaign.id === 2 ? actor : "bob.testnet" }]);
let failedOwnership = -1, failedBalance = -1, failTokens = false, mismatch = false, badAmount = false;
const calls = [];
const contract = {
  getClaimable: async (id, account) => { calls.push(["claimable", id, account]); if (id === failedBalance) throw new Error("Balance RPC failure"); return badAmount ? "0.1" : id === 1 ? big : id === 0 ? "1" : "0"; },
  getClaimed: async (id, account) => { calls.push(["claimed", id, account]); return id === 3 ? "2" : "0"; },
  getCampaignRights: async (id) => { if (id === failedOwnership) throw new Error("Ownership RPC failure"); return rights[id]; },
  getAllNftTokensForOwner: async () => { if (failTokens) throw new Error("NFT listing unavailable"); return [{ token_id: mismatch ? "campaign:999:right:0" : "campaign:2:right:0", owner_id: actor }]; },
};
const model = load("src/lib/wallet-earnings.ts", { "./zinc-contract": contract });
(async () => {
  const balances = await model.readEarningsBalances(campaigns, actor);
  assert.equal(balances.reduce((sum, row) => sum + row.claimable, 0n), BigInt(big) + 1n);
  assert.equal(calls.length, 10, "Every campaign needs both balance reads, including zero-balance former owners");
  assert.ok(calls.every((call) => call[2] === actor));
  assert.throws(() => model.validateEarningsCampaigns([...campaigns, campaigns[0]]), /duplicated/);
  failedBalance = 0; await assert.rejects(model.readEarningsBalances(campaigns, actor), /Balance RPC/); failedBalance = -1;
  badAmount = true; await assert.rejects(model.readEarningsBalances(campaigns, actor), /Invalid earnings/); badAmount = false;
  let ownership = await model.readEarningsOwnership(campaigns, actor);
  assert.equal(ownership.ownedCount, 1); assert.equal(ownership.warnings.length, 0);
  const held = new Set(["campaign:4:right:0"]);
  let related = model.relatedEarningsRows(balances, ownership, held, actor);
  assert.equal(related.length, 5, "A received-then-transferred right with zero balances remains related through history");
  assert.equal(related[0].campaign.id, 1, "Large claimable balances sort using BigInt comparisons");
  assert.ok(related.find((row) => row.campaign.id === 4).previousRights);
  assert.equal(model.filterEarningsRows(related, "Claimable").length, 2);
  assert.equal(model.filterEarningsRows(related, "Current rights")[0].campaign.id, 2);
  assert.equal(model.filterEarningsRows(related, "Treasury")[0].campaign.id, 3);
  assert.ok(model.filterEarningsRows(related, "Previously held").some((row) => row.campaign.id === 0));
  failedOwnership = 0; const partial = await model.readEarningsOwnership(campaigns, actor); failedOwnership = -1;
  assert.equal(partial.rights.get(0), null); assert.equal(partial.ownedCount, 1);
  const unknownRow = model.relatedEarningsRows(balances, partial, held, actor).find((row) => row.campaign.id === 0);
  assert.equal(unknownRow.claimable, 1n); assert.equal(unknownRow.currentRights, null); assert.equal(unknownRow.previousRights, false); assert.equal(unknownRow.retainedRevenue, false);
  failTokens = true; assert.equal((await model.readEarningsOwnership(campaigns, actor)).ownedCount, null); failTokens = false;
  mismatch = true; const inconsistent = await model.readEarningsOwnership(campaigns, actor); mismatch = false;
  assert.equal(inconsistent.ownedCount, null); assert.ok([...inconsistent.rights.values()].every((value) => value === null));
  assert.equal(balances[0].claimable, 1n, "Ownership failures cannot alter a complete balance snapshot");
  const near = await import("near-api-js"); let connected = null;
  const component = load("src/components/earnings/WalletEarnings.tsx", {
    "next/link": { __esModule: true, default: ({ href, children, ...props }) => React.createElement("a", { href, ...props }, children) },
    "near-api-js": near, "../wallet/WalletProvider": { useWallet: () => ({ accountId: connected, connect() {} }) }, "../data/useReadRefresh": {},
    "../../lib/zinc-contract": {}, "../../lib/zinc-activity": {}, "../../lib/right-history": {}, "../../lib/wallet-earnings": model,
    "../nfts/RevenueRightCard": { rightHref: (token) => `/rights/${encodeURIComponent(token)}` },
  });
  const render = (rows, loading = false) => renderToStaticMarkup(React.createElement(component.EarningsResults, { rows, relatedCount: rows.length, filter: "All", enrichmentLoading: loading }));
  let html = render(related);
  assert.ok(html.includes("900719.925474099312345678901234 NEAR"));
  assert.ok(html.includes('href="/campaigns/0#claim-revenue"')); assert.ok(html.includes("Claim available revenue"));
  assert.ok(html.includes(`/rights/${encodeURIComponent("campaign:2:right:0")}`));
  assert.ok(html.includes("Treasury")); assert.ok(html.includes("Retained historical earnings"));
  html = render([unknownRow]); assert.ok(html.includes("Current ownership unavailable")); assert.ok(!html.includes("Previously held rights"));
  html = render([], true); assert.ok(html.includes("data loaded so far")); assert.ok(html.includes("balance totals are already complete"));
  html = renderToStaticMarkup(React.createElement(component.default)); assert.ok(html.includes("Connect your wallet"));
  connected = actor; assert.equal(component.default().key, actor); connected = "bob.testnet"; assert.equal(component.default().key, connected);
  console.log("PASS: complete BigInt balances, all-campaign queries, duplicate/invalid data rejection, independent ownership failure, ownership-race handling, zero-balance former owners, filters, claim links, exact formatting, loading and wallet isolation. Mock reads only; no network transactions sent.");
})().catch((error) => { console.error(error); process.exitCode = 1; });
