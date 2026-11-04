// Local route and rendering checks; fixture data only, no wallet/RPC transactions.
const fs = require("fs"), ts = require("typescript"), vm = require("vm"), React = require("react"), assert = require("node:assert/strict");
const { renderToStaticMarkup } = require("react-dom/server");
function load(path, overrides) {
  const api = {};
  const source = ts.transpileModule(fs.readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  vm.runInNewContext(source, { exports: api, require: (id) => id in overrides ? overrides[id] : require(id) });
  return api;
}
const link = { __esModule: true, default: ({ href, children, ...props }) => React.createElement("a", { href, ...props }, children) };
const FixturePayment = () => null;
const campaign = { id: 6, creator: "creator.testnet", name: "Créateurs <script>unsafe</script>", description: "Music campaign", start_timestamp_ms: 1000, end_timestamp_ms: 2000,
  contributors: [{ role: "Artist", account_id: "alice.testnet", share_bps: 6000 }], treasury_account: "treasury.testnet", treasury_share_bps: 4000, total_deposited_yocto: "1" };
const rights = [{ campaign_id: 6, contributor_index: 0, role: "Artist", share_bps: 6000, owner_id: "bob.testnet", token_id: "campaign:6:right:0" }];
let calls = 0, current = campaign, failCampaign = false, failRights = false;
const page = load("src/app/pay/[id]/page.tsx", {
  "next/link": link, "next/server": { connection: async () => {} },
  "../../../components/campaigns/CampaignPayment": { __esModule: true, default: FixturePayment },
  "../../../lib/zinc-contract": {
    getCampaign: async () => { calls++; if (failCampaign) throw new Error("RPC"); return current; },
    getCampaignRights: async () => { if (failRights) throw new Error("RPC"); return rights; },
  },
});
function findContent(element) {
  if (!React.isValidElement(element)) return;
  if (typeof element.type === "function" && element.type.name === "PaymentContent") return element;
  for (const child of React.Children.toArray(element.props.children)) { const found = findContent(child); if (found) return found; }
}
async function resolvePage(id) {
  const content = findContent(page.default({ params: Promise.resolve({ id }) }));
  return content.type(content.props);
}
(async () => {
  for (const id of ["bad", "-1", "9007199254740992"]) {
    const result = await resolvePage(id); assert.equal(result.props.title, "Campaign not found");
  }
  assert.equal(calls, 0);
  let result = await resolvePage("6"); assert.equal(result.type, FixturePayment); assert.equal(result.props.campaign.id, 6);
  assert.equal(result.props.rights[0].owner_id, "bob.testnet"); assert.equal(result.props.initiallyActive, false);
  failRights = true; result = await resolvePage("6"); assert.equal(result.type, FixturePayment); assert.equal(result.props.rights, null);
  current = null; result = await resolvePage("99"); assert.equal(result.props.title, "Campaign not found");
  current = campaign; failCampaign = true; result = await resolvePage("6"); assert.equal(result.props.title, "Unable to load this campaign");
  const near = await import("near-api-js");
  let formProps;
  const payment = load("src/components/campaigns/CampaignPayment.tsx", {
    "next/link": link, "near-api-js": near, "../../lib/near": { ZINC_CONTRACT_ID: "zinc-builder-2026.testnet" },
    "./DepositRevenueForm": { __esModule: true, default: (props) => { formProps = props; return React.createElement("div", null, "Payment form"); } },
    "../transactions/TransactionRecovery": { __esModule: true, default: () => null },
    "../nfts/RevenueRightCard": { rightHref: (id) => `/rights/${encodeURIComponent(id)}` },
  });
  const html = renderToStaticMarkup(React.createElement(payment.default, { campaign, rights, initiallyActive: false }));
  assert.equal(formProps.purpose, "support"); assert.equal(formProps.campaignId, 6); assert.equal(formProps.initiallyActive, false);
  assert.ok(html.includes("0.000000000000000000000001")); assert.ok(html.includes("Total allocation: 100%"));
  assert.ok(html.includes("bob.testnet")); assert.ok(html.includes("treasury.testnet"));
  assert.ok(html.includes("does not purchase a ticket")); assert.ok(!html.includes("<script>"));
  console.log("PASS: invalid/missing campaign states, RPC fallback, independent ownership failure, exact yocto formatting, current owners and treasury, 100% allocation, support-mode wiring, and escaped campaign text. No network transactions sent.");
})().catch((error) => { console.error(error); process.exitCode = 1; });
