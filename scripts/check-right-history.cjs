// Real React rendering and receipt-backed history fixtures; no chain transactions.
const fs = require("node:fs"), ts = require("typescript"), vm = require("node:vm"), React = require("react"), assert = require("node:assert/strict");
const { renderToStaticMarkup } = require("react-dom/server");
function load(file, overrides = {}) {
  const api = {};
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  vm.runInNewContext(code, { exports: api, require: (id) => id in overrides ? overrides[id] : require(id) });
  return api;
}
const model = load("src/lib/right-history.ts");
const hash = "A".repeat(44), token = "campaign:6:right:0";
const mint = { id: "mint", source: "rpc", kind: "NFT Mints", tokenId: token, account: "creator.testnet", to: "alice.testnet", hash, timestampMs: 1000 };
const transfer = { ...mint, id: "transfer", kind: "NFT Transfers", from: "alice.testnet", to: "bob.testnet", timestampMs: 2000 };
const returned = { ...transfer, id: "returned", from: "bob.testnet", to: "alice.testnet", timestampMs: 3000 };
const events = model.rightOwnershipEvents([
  mint, transfer, returned, transfer,
  { ...transfer, id: "wallet", source: "wallet" },
  { ...transfer, id: "other-token", tokenId: "campaign:6:right:1" },
  { ...transfer, id: "claim", kind: "Claims", amountYocto: "1" },
  { ...transfer, id: "bad-from", from: undefined },
  { ...transfer, id: "bad-account", to: "<script>bad</script>" },
  { ...transfer, id: "bad-hash", hash: "invalid" },
  { ...transfer, id: "bad-time", timestampMs: Infinity },
  { ...transfer, id: "date-overflow", timestampMs: 8640000000000001 },
], token);
assert.equal(events.length, 3);
assert.equal(events[0].id, "returned"); assert.equal(events[2].kind, "NFT Mints");
assert.equal(events[1].hash, events[2].hash, "Different events in one transaction must remain distinct");
assert.equal(events[1].from, "alice.testnet"); assert.equal(events[1].to, "bob.testnet");
assert.equal(model.rightOwnershipEvents([], token).length, 0, "No synthetic history from current ownership");
assert.ok(model.previouslyHeldRightIds([transfer], "bob.testnet").has(token), "A recipient can retain history after transferring onward");
assert.ok(model.previouslyHeldRightIds([transfer], "alice.testnet").has(token));
assert.ok(model.previouslyHeldRightIds([mint], "alice.testnet").has(token));
assert.equal(model.previouslyHeldRightIds([{ ...transfer, account: "operator.testnet" }], "operator.testnet").size, 0, "An approved operator is not necessarily an owner");
assert.equal(model.previouslyHeldRightIds([{ ...transfer, source: "wallet" }], "bob.testnet").size, 0);
assert.equal(model.previouslyHeldRightIds([{ ...transfer, tokenId: "external-token" }], "bob.testnet").size, 0);
const link = { __esModule: true, default: ({ href, children, ...props }) => React.createElement("a", { href, ...props }, children) };
const component = load("src/components/nfts/RightOwnershipHistory.tsx", { "next/link": link, "../../lib/right-history": model, "../../lib/zinc-activity": {} });
const props = { tokenId: token, campaignId: 6, originalOwner: "alice.testnet", currentOwner: "bob.testnet", accountId: "alice.testnet", events, status: "ready", limit: 5, onRefresh() {}, onMore() {} };
function render(overrides = {}) { return renderToStaticMarkup(React.createElement(component.OwnershipHistoryView, { ...props, ...overrides })); }
let html = render();
assert.ok(html.includes("Original contributor")); assert.ok(html.includes("Current NFT owner"));
assert.ok(html.includes("alice.testnet")); assert.ok(html.includes("bob.testnet"));
assert.ok(html.includes("Revenue right minted")); assert.ok(html.includes("Revenue right transferred"));
assert.ok(html.includes(`https://testnet.nearblocks.io/txns/${hash}`));
assert.ok(html.includes(`/transactions?token=${encodeURIComponent(token)}`));
assert.ok(html.includes("Coverage may have gaps")); assert.ok(html.includes("not shown here as individual NFT payouts"));
assert.ok(html.includes('href="#campaign-account-earnings"'));
assert.ok(!render({ accountId: null }).includes('href="#campaign-account-earnings"'));
html = render({ status: "error", events: [] });
assert.ok(html.includes('role="alert"')); assert.ok(html.includes("Current ownership and campaign earnings remain available"));
assert.ok(html.includes("bob.testnet")); assert.ok(!html.includes("No verified events recorded yet"));
html = render({ status: "loading", events: [] });
assert.ok(html.includes('role="status"')); assert.ok(html.includes("Loading verified ownership events"));
html = render({ events: [] });
assert.ok(html.includes("No verified events recorded yet")); assert.ok(html.includes("This NFT exists on-chain"));
assert.ok(!html.includes("Revenue right transferred"));
const many = Array.from({ length: 12 }, (_, index) => ({ ...transfer, id: `transfer:${index}` }));
html = render({ events: many, limit: 5 });
assert.equal((html.match(/<li /g) ?? []).length, 5); assert.ok(html.includes("7 remaining"));
assert.equal((render({ events: many, limit: 15 }).match(/<li /g) ?? []).length, 12);
html = render({ originalOwner: "<script>bad</script>", tokenId: 'token"<script>' });
assert.ok(!html.includes("<script>")); assert.ok(html.includes("&lt;script&gt;"));
const receipt = load("src/components/nfts/TransferReceipt.tsx", { "next/link": link, "./RevenueRightCard": { rightHref: (id) => `/rights/${encodeURIComponent(id)}` } });
html = renderToStaticMarkup(React.createElement(receipt.default, { transfer: { tokenId: token, from: "alice.testnet", to: "bob.testnet", campaignId: 6, hash } }));
assert.ok(html.includes("Revenue right transferred")); assert.ok(html.includes("Transfer recipient"));
assert.ok(html.includes("alice.testnet")); assert.ok(html.includes("bob.testnet"));
assert.ok(html.includes("Exactly 1 yoctoNEAR")); assert.ok(html.includes("does not include a sale payment"));
assert.ok(html.includes(`/txns/${hash}`)); assert.ok(html.includes('href="/campaigns/6"'));
assert.ok(html.includes(`/rights/${encodeURIComponent(token)}`)); assert.ok(!html.includes("Confirm in wallet"));
console.log("PASS: exact-token verified events only, duplicate-event handling, same-transaction events, transfers back, safe times, honest gaps, owner/wallet labels, explorer links, loading/error/empty states, pagination and escaped content. No network transactions sent.");
