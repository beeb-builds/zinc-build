// Confirmation fixtures and real React rendering; no wallet or chain writes.
const fs = require("node:fs"), ts = require("typescript"), vm = require("node:vm"), React = require("react"), assert = require("node:assert/strict");
const { renderToStaticMarkup } = require("react-dom/server");
function load(file, overrides = {}) {
  const api = {};
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  vm.runInNewContext(code, { exports: api, atob, TextDecoder, Uint8Array, require: (id) => id in overrides ? overrides[id] : require(id) });
  return api;
}
const near = { ZINC_CONTRACT_ID: "zinc-builder-2026.testnet" };
const verify = load("src/lib/verify-transaction.ts", { "./near": near });
const helper = load("src/lib/campaign-confirmation.ts", { "./near": near, "./verify-transaction": verify });
const hash = "A".repeat(44);
const outcome = (value) => ({ transaction: { receiver_id: near.ZINC_CONTRACT_ID, hash }, status: { SuccessValue: Buffer.from(JSON.stringify(value)).toString("base64") },
  transaction_outcome: { outcome: { status: { SuccessReceiptId: "receipt" } } }, receipts_outcome: [{ outcome: { status: { SuccessValue: "" } } }] });
assert.equal(helper.campaignConfirmation(outcome({ id: 0 })).campaignId, 0);
assert.equal(helper.campaignConfirmation(outcome({ id: 7, name: "Créateurs 音楽" })).campaignId, 7);
for (const value of [{}, { id: -1 }, { id: "7" }, { id: 9007199254740992 }]) {
  const result = helper.campaignConfirmation(outcome(value));
  assert.equal(result.campaignId, null); assert.equal(result.hash, hash);
}
const brokenReturn = outcome({ id: 7 }); brokenReturn.status.SuccessValue = "not-json";
assert.equal(helper.campaignConfirmation(brokenReturn).campaignId, null);
assert.throws(() => helper.campaignConfirmation(null), /not been confirmed/);
const wrongReceiver = outcome({ id: 7 }); wrongReceiver.transaction.receiver_id = "other.testnet";
assert.throws(() => helper.campaignConfirmation(wrongReceiver), /not been confirmed/);
const failed = outcome({ id: 7 }); failed.receipts_outcome[0].outcome.status = { Failure: {} };
assert.throws(() => helper.campaignConfirmation(failed), /not been confirmed/);
const unresolved = outcome({ id: 7 }); unresolved.status = "Started";
assert.throws(() => helper.campaignConfirmation(unresolved), /not been confirmed/);
const malformedHash = outcome({ id: 7 }); malformedHash.transaction.hash = 'bad"hash';
assert.equal(helper.campaignConfirmation(malformedHash).hash, null);
const link = { __esModule: true, default: ({ href, children, ...props }) => React.createElement("a", { href, ...props }, children) };
const card = load("src/components/nfts/RevenueRightCard.tsx", { "next/link": link });
const paymentLink = load("src/components/campaigns/CampaignPaymentLink.tsx", { "next/link": link });
const created = load("src/components/campaigns/CampaignCreated.tsx", {
  "next/link": link, "../../lib/zinc-contract": {}, "../data/useReadRefresh": {}, "../nfts/RevenueRightCard": card, "./CampaignPaymentLink": paymentLink,
});
const campaign = { id: 7, name: "Music <script>unsafe</script>", contributors: [{ account_id: "alice.testnet", role: "Artist", share_bps: 6000 }] };
const rights = [{ campaign_id: 7, contributor_index: 0, token_id: "campaign:7:right:0", role: "Artist", owner_id: "alice.testnet", share_bps: 6000 }];
const props = { confirmation: { campaignId: 7, hash }, campaign, rights, loading: false, onRefresh() {} };
const render = (extra = {}) => renderToStaticMarkup(React.createElement(created.CampaignCreatedView, { ...props, ...extra }));
let html = render();
assert.ok(html.includes('href="/campaigns/7"')); assert.ok(html.includes('href="/pay/7"')); assert.ok(html.includes('href="/workspace/7"'));
assert.ok(html.includes(`/rights/${encodeURIComponent(rights[0].token_id)}`)); assert.ok(html.includes("alice.testnet"));
assert.ok(html.includes("60")); assert.ok(html.includes("real token IDs and current owners"));
assert.ok(html.includes('href="#created-rights"')); assert.ok(html.includes('id="created-rights"'));
assert.ok(html.includes('href="/campaigns/7#project-team"')); assert.ok(html.includes("Open minted NFT"));
assert.ok(!html.includes("<script>")); assert.ok(html.includes("&lt;script&gt;"));
assert.ok(!html.includes("Draft preview"));
html = render({ campaign: null, rights: null });
assert.ok(html.includes("Campaign created on NEAR")); assert.ok(html.includes('role="alert"'));
assert.ok(html.includes("Do not create it again")); assert.ok(!html.includes("Create Campaign on NEAR"));
html = render({ loading: true, campaign: null, rights: null });
assert.ok(html.includes("Reading the created campaign")); assert.ok(html.includes("Campaign created on NEAR"));
html = render({ confirmation: { campaignId: null, hash }, campaign: null, rights: null });
assert.ok(html.includes("returned campaign ID could not be read")); assert.ok(html.includes(`/txns/${hash}`));
assert.ok(!html.includes('href="/pay/')); assert.ok(!html.includes('href="/campaigns/null"'));
console.log("PASS: verified execution only, zero/Unicode IDs, unsafe/missing return fallback, failed receipts, safe explorer hashes, real NFT links/owners, support/workspace links, successful-write vs read-failure separation, and escaped output. No network transactions sent.");
