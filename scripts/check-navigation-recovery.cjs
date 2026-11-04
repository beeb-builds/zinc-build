// Real React rendering and retry-handler fixtures. No RPC, wallet signing or writes.
const fs = require("node:fs"), ts = require("typescript"), vm = require("node:vm"), React = require("react"), assert = require("node:assert/strict");
const { renderToStaticMarkup } = require("react-dom/server");
function load(file, overrides = {}) {
  const api = {}, code = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  vm.runInNewContext(code, { exports: api, require: (id) => id in overrides ? overrides[id] : require(id) });
  return api;
}
const context = React.createContext(null);
let pendingHref = null, pathname = "/", links = [];
const link = { __esModule: true,
  default: ({ href, children, prefetch, ...props }) => { links.push({ href, prefetch }); return React.createElement(context.Provider, { value: href }, React.createElement("a", { href, ...props }, children)); },
  useLinkStatus: () => { const href = React.useContext(context); assert.notEqual(href, null, "Pending status must be read inside a Link descendant"); return { pending: href === pendingHref }; },
};
const hint = load("src/components/layout/NavigationPending.tsx", { "next/link": link });
const shell = load("src/components/layout/DashboardShell.tsx", {
  "next/link": link, "next/navigation": { usePathname: () => pathname }, "./NavigationPending": hint,
  "../wallet/WalletProvider": { useWallet: () => ({ accountId: null, connect() {}, disconnect() {} }) },
  "../transactions/TransactionRecovery": { __esModule: true, default: () => null },
});
const renderShell = () => renderToStaticMarkup(React.createElement(shell.default, { title: "Overview", subtitle: "Revenue rights" }, React.createElement("p", null, "Current page content")));
let html = renderShell();
assert.ok(!html.includes("Opening Campaigns...")); assert.ok(!html.includes("zinc-nav-pending"));
assert.ok(html.includes("Current page content")); assert.ok(html.includes("Skip to page content"));
for (const href of ["/", "/campaigns", "/nfts", "/earnings", "/transactions", "/settings"]) assert.ok(links.some((item) => item.href === href));
assert.ok(links.every((item) => item.prefetch !== false), "Native prefetching must remain enabled");
pendingHref = "/campaigns"; html = renderShell();
assert.equal((html.match(/Opening Campaigns\.\.\./g) ?? []).length, 2, "Desktop and mobile navigation both report pending transitions");
assert.equal((html.match(/class="zinc-nav-pending /g) ?? []).length, 2);
assert.equal((html.match(/aria-current="page"/g) ?? []).length, 2, "Pending links must not replace the actual active route");
assert.ok(html.includes("Current page content"));
pendingHref = "/nfts"; html = renderShell(); assert.ok(!html.includes("Opening Campaigns...")); assert.ok(html.includes("Opening My NFTs..."));
pendingHref = null; html = renderShell(); assert.ok(!html.includes('role="status"'));
pathname = "/rights/campaign%3A6%3Aright%3A0"; html = renderShell(); assert.equal((html.match(/aria-current="location"/g) ?? []).length, 2);

let retrying = false, retries = 0, transitions = 0;
const error = load("src/app/error.tsx", { "next/link": link, react: { ...React, useTransition: () => [retrying, (action) => { transitions++; action(); }] } });
const props = { error: new Error("PRIVATE INTERNAL DETAILS <script>"), retry: () => { retries++; } };
const renderError = () => renderToStaticMarkup(React.createElement(error.default, props));
html = renderError();
assert.ok(html.includes('href="/transactions"')); assert.ok(html.includes('href="/"'));
assert.ok(html.includes("does not resend a transaction")); assert.ok(html.includes("whether your transaction succeeded"));
assert.ok(!html.includes("PRIVATE INTERNAL DETAILS")); assert.ok(!html.includes("<script>"));
assert.ok(!html.includes('disabled=""'));
function find(node, type) {
  if (!React.isValidElement(node)) return;
  if (node.type === type) return node;
  for (const child of React.Children.toArray(node.props.children)) { const result = find(child, type); if (result) return result; }
}
find(error.default(props), "button").props.onClick();
assert.equal(retries, 1); assert.equal(transitions, 1, "Retry must use the framework's re-fetching retry callback inside a transition");
retrying = true; html = renderError(); assert.ok(html.includes('disabled=""')); assert.ok(html.includes("Loading page...")); assert.ok(html.includes('role="status"'));
console.log("PASS: Link-scoped pending states, desktop/mobile feedback, superseded navigation, active-route labels, native prefetch preservation, safe error content, retry callback, and transaction recovery guidance. Rendering/handler fixtures only; no browser or network transactions.");
