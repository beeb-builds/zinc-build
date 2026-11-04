// Exercise the actual async server route and client token lookup with encoded links.
const fs = require("node:fs"), ts = require("typescript"), vm = require("node:vm"), React = require("react"), assert = require("node:assert/strict");
function load(file, overrides) {
  const api = {}, code = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  vm.runInNewContext(code, { exports: api, require: (id) => id in overrides ? overrides[id] : require(id) }); return api;
}
const marker = () => null, tokenId = "campaign:2:right:0";
const page = load("src/app/rights/[tokenId]/page.tsx", {
  "next/server": { connection: async () => {} },
  "../../../components/layout/DashboardShell": { __esModule: true, default: marker },
  "../../../components/nfts/RevenueRightDetails": { __esModule: true, default: marker },
});
function find(node, predicate) { if (!React.isValidElement(node)) return; if (predicate(node)) return node; for (const child of React.Children.toArray(node.props.children)) { const result = find(child, predicate); if (result) return result; } }
async function resolve(segment) {
  const tree = page.default({ params: Promise.resolve({ tokenId: segment }) });
  const content = find(tree, (node) => typeof node.type === "function" && node.type.name === "RightContent");
  return (await content.type(content.props)).props.tokenId;
}
(async () => {
  assert.equal(await resolve(encodeURIComponent(tokenId)), tokenId);
  assert.equal(await resolve(tokenId), tokenId);
  assert.equal(await resolve(encodeURIComponent(encodeURIComponent(tokenId))), encodeURIComponent(tokenId), "Decode exactly once");
  assert.equal(await resolve("%invalid"), "%invalid", "Malformed escapes must not throw the whole route");
  const near = await import("near-api-js");
  let effect, values, calls;
  const details = load("src/components/nfts/RevenueRightDetails.tsx", {
    react: { ...React, useEffect: (callback) => { effect = callback; }, useState: (initial) => [initial, (value) => values.push(value)] },
    "near-api-js": near, "next/link": { default: marker }, "./RevenueRightCard": { default: marker }, "./RightOwnershipHistory": { default: marker },
    "../campaigns/ClaimRevenueSection": { default: marker }, "../wallet/WalletProvider": { useWallet: () => ({ accountId: null }) },
    "../data/useReadRefresh": { useReadRefresh: () => ({ version: 0, refresh() {} }) }, "../../lib/near": { ZINC_CONTRACT_ID: "zinc-builder-2026.testnet" },
    "../../lib/zinc-contract": {
      getNftToken: async (id) => { calls.push(["token", id]); return { token_id: id, owner_id: "alice.testnet" }; },
      getRevenueRight: async (id) => { calls.push(["right", id]); return { token_id: id, owner_id: "alice.testnet", campaign_id: 2, contributor_index: 0 }; },
      getCampaign: async () => ({ contributors: [{}], total_deposited_yocto: "0" }),
    },
  });
  async function mount(segment) { values = []; calls = []; details.default({ tokenId: await resolve(segment) }); const cleanup = effect(); await new Promise(setImmediate); cleanup(); }
  await mount(encodeURIComponent(tokenId)); assert.equal(calls.length, 2); assert.ok(calls.every((call) => call[1] === tokenId)); assert.ok(values.includes("ready"));
  for (const invalid of ["%invalid", encodeURIComponent(encodeURIComponent(tokenId)), encodeURIComponent("campaign:2:right:0/extra")]) {
    await mount(invalid); assert.equal(calls.length, 0); assert.ok(values.includes("missing"));
  }
  console.log("PASS: encoded NFT card links reach exact token/right reads, decoded input compatibility, single decoding, malformed/double-encoded IDs rejected without RPC and ready-state rendering. No network transactions.");
})().catch((error) => { console.error(error); process.exitCode = 1; });
