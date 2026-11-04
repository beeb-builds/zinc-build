// Public preview fixtures only. Authorization remains covered by check-holder-workspace.cjs.
const fs = require("node:fs"), ts = require("typescript"), vm = require("node:vm"), React = require("react"), assert = require("node:assert/strict");
const { renderToStaticMarkup } = require("react-dom/server");
function load(file, overrides = {}) {
  const api = {}, code = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  vm.runInNewContext(code, { exports: api, require: (id) => id in overrides ? overrides[id] : require(id) }); return api;
}
const model = load("src/lib/workspace-eligibility.ts");
const campaign = { id: 6, creator: "creator.testnet", name: "Music <script>unsafe</script>", contributors: [{ role: "Artist", account_id: "alice.testnet", share_bps: 6000 }], treasury_account: "treasury.testnet" };
const rights = [{ campaign_id: 6, contributor_index: 0, token_id: "campaign:6:right:0", role: "Artist", share_bps: 6000, owner_id: "bob.testnet" }];
const creator = model.workspaceEligibility(campaign, rights, campaign.creator);
assert.equal(creator.role, "creator"); assert.equal(creator.ownedRights, 0, "Creator role persists separately after transferring an NFT");
assert.equal(model.workspaceEligibility(campaign, null, campaign.creator).role, "creator");
const holder = model.workspaceEligibility(campaign, rights, "bob.testnet"); assert.equal(holder.role, "holder"); assert.equal(holder.ownedRights, 1);
const former = model.workspaceEligibility(campaign, rights, "alice.testnet"); assert.equal(former.role, "ineligible"); assert.ok(former.originalContributor);
const treasury = model.workspaceEligibility(campaign, rights, campaign.treasury_account); assert.equal(treasury.role, "ineligible"); assert.ok(treasury.treasury);
assert.equal(model.workspaceEligibility(campaign, [{ ...rights[0], owner_id: campaign.treasury_account }], campaign.treasury_account).role, "holder");
const unknown = model.workspaceEligibility(campaign, null, "alice.testnet"); assert.equal(unknown.role, "unknown"); assert.equal(unknown.ownedRights, null);
for (const invalid of [[], [...rights, rights[0]], [{ ...rights[0], campaign_id: 7 }], [{ ...rights[0], share_bps: 5000 }], [{ ...rights[0], token_id: "wrong-token" }]]) assert.equal(model.workspaceEligibility(campaign, invalid, "bob.testnet").role, "unknown");
const transferred = [{ ...rights[0], owner_id: "alice.testnet" }];
assert.equal(model.workspaceEligibility(campaign, transferred, "alice.testnet").role, "holder");
assert.equal(model.workspaceEligibility(campaign, transferred, "bob.testnet").role, "ineligible");
const component = load("src/components/workspace/WorkspaceEligibility.tsx", { "next/link": { __esModule: true, default: ({ href, children }) => React.createElement("a", { href }, children) }, "../../lib/zinc-contract": {}, "../../lib/workspace-eligibility": model, "../data/useReadRefresh": {} });
const render = (preview, state = "ready") => renderToStaticMarkup(React.createElement(component.WorkspaceEligibilityView, { campaignId: 6, preview, state, busy: false, onRefresh() {} }));
let html = render(creator); assert.ok(html.includes("separate editorial role")); assert.ok(html.includes("read and publish")); assert.ok(!html.includes("<script>"));
html = render(holder); assert.ok(html.includes("read-only access")); assert.ok(html.includes("not an access grant")); assert.ok(html.includes("fresh finalized ownership checks"));
html = render(former); assert.ok(html.includes('href="/campaigns/6#claim-revenue"')); assert.ok(html.includes("Former ownership and treasury status alone"));
html = render(unknown); assert.ok(html.includes("Current ownership could not be verified")); assert.ok(!html.includes("in this snapshot: 0"));
html = render({ ...holder, brief: { title: "PRIVATE TITLE", body: "PRIVATE BODY" } }); assert.ok(!html.includes("PRIVATE TITLE")); assert.ok(!html.includes("PRIVATE BODY"));
assert.ok(render(null, "loading").includes("Reading public campaign roles"));
assert.ok(render(null, "error").includes("unavailable ownership is not treated as zero holdings"));
assert.ok(render(null, "missing").includes("No workspace signature is needed"));
console.log("PASS: creator editorial role, current-holder eligibility, former/treasury distinctions, transfer changes, incomplete/invalid ownership as unknown, read-only preview language, claim links, safe rendering and no private brief fields. No RPC calls or signatures.");
