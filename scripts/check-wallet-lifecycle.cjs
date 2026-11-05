// Wallet startup/store fixtures only. Never opens a real wallet or sends a transaction.
const fs = require("node:fs"), ts = require("typescript"), vm = require("node:vm"), React = require("react"), assert = require("node:assert/strict");
const { renderToStaticMarkup } = require("react-dom/server");
function compile(file) { return ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText; }
function load(file, overrides, globals = {}) { const api = {}; vm.runInNewContext(compile(file), { exports: api, URL, ...globals, require: (id) => id in overrides ? overrides[id] : require(id) }); return api; }
const tick = () => new Promise(setImmediate);
function fixture() {
  let slots = {}, cursor = 0, effect, accounts = [], subscribers = new Set(), shows = 0, starts = 0, failShow = false, failSignOut = false, selectedWalletId = null, sessionIssue = null, signIns = 0, failSignIn = false;
  const listeners = new Map();
  const browser = { addEventListener: (name, callback) => listeners.set(name, callback), removeEventListener: (name) => listeners.delete(name), setInterval: () => 1, clearInterval() {} };
  const doc = { visibilityState: 'visible', addEventListener: browser.addEventListener, removeEventListener: browser.removeEventListener };
  let complete, reject;
  const hooks = { ...React, useEffect(callback) { effect = callback; },
    useState(initial) { const key = cursor++; if (!(key in slots)) slots[key] = initial; return [slots[key], (value) => { slots[key] = typeof value === "function" ? value(slots[key]) : value; }]; },
    useRef(initial) { const key = cursor++; if (!(key in slots)) slots[key] = { current: initial }; return slots[key]; } };
  const selector = { store: { getState: () => ({ accounts, selectedWalletId }), observable: { subscribe(callback) { subscribers.add(callback); return { unsubscribe: () => subscribers.delete(callback) }; } } },
    wallet: async () => ({ type: 'injected', signOut: async () => { if (failSignOut) throw new Error("Wallet error"); accounts = []; subscribers.forEach((callback) => callback()); },
      signIn: async () => { signIns++; if (failSignIn) throw new Error('Nightly cannot reconnect'); sessionIssue = null; subscribers.forEach(callback => callback()); return accounts; } }) };
  const provider = load("src/components/wallet/WalletProvider.tsx", {
    react: hooks, "../../lib/near": { ZINC_CONTRACT_ID: "zinc-builder-2026.testnet" },
    "../../lib/wallet-session": { nightlySessionIssue: () => sessionIssue, WALLET_SESSION_CHANGED: 'wallet-session' },
    "../../lib/wallet-selector": { createWalletSelector: () => { starts++; return new Promise((resolve, fail) => { complete = () => resolve(selector); reject = fail; }); } },
    "@near-wallet-selector/modal-ui": { setupModal: (_selector, options) => { assert.equal(options.contractId, "zinc-builder-2026.testnet"); return { show() { if (failShow) throw new Error("Modal error"); shows++; } }; } },
  }, {window:browser,document:doc});
  function render() { cursor = 0; return provider.WalletProvider({ children: "Public pages remain visible" }); }
  return { render, value: () => render().props.value, effect: () => effect(), complete: () => complete(), reject: () => reject(new Error("Startup unavailable")),
    accounts(value) { accounts = value; subscribers.forEach((callback) => callback()); },
    sessionIssue(value) { selectedWalletId = 'nightly'; sessionIssue = value; },
    failSignIn(value) { failSignIn = value; }, get signIns() { return signIns; },
    emit(name) { listeners.get(name)?.(); }, get listeners() { return listeners.size; },
    failShow(value) { failShow = value; }, failSignOut(value) { failSignOut = value; },
    get shows() { return shows; }, get starts() { return starts; }, get subscriptions() { return subscribers.size; } };
}
(async () => {
  const f = fixture(); assert.equal(f.value().isInitializing, true); assert.equal(f.value().accountId, null);
  assert.ok(f.render().props.children.includes("Public pages remain visible"));
  const canceled = f.effect(); await tick();
  f.value().connect(); f.value().connect(); assert.equal(f.value().isConnecting, true);
  canceled(); const cleanup = f.effect(); await tick();
  assert.equal(f.starts, 1, "Strict Mode replay and repeated connects must share initialization");
  f.accounts([{ accountId: "old.testnet", active: false }, { accountId: "alice.testnet", active: true }]); f.complete(); await tick();
  assert.equal(f.value().accountId, "alice.testnet"); assert.equal(f.value().isInitializing, false); assert.equal(f.value().isConnecting, false);
  assert.equal(f.shows, 1, "An early connect request must open the modal once when ready"); assert.equal(f.subscriptions, 1);
  f.accounts([{ accountId: "bob.testnet", active: true }]); assert.equal(f.value().accountId, "bob.testnet");
  f.sessionIssue('Nightly is disconnected.'); f.emit('focus'); assert.equal(f.value().accountId, null);
  assert.ok(renderToStaticMarkup(f.render()).includes('Reconnect wallet'));
  f.sessionIssue(null); f.emit('wallet-session'); assert.equal(f.value().accountId, 'bob.testnet');
  f.sessionIssue('Nightly is disconnected.'); f.emit('focus');
  f.value().connect(); f.value().connect(); await tick();
  assert.equal(f.signIns, 1); assert.equal(f.shows, 1, 'Reconnect must bypass the already-selected modal shortcut');
  assert.equal(f.value().accountId, 'bob.testnet'); assert.equal(f.value().isConnecting, false);
  f.sessionIssue('Nightly is disconnected.'); f.emit('focus'); f.failSignIn(true); f.value().connect(); await tick();
  assert.equal(f.value().accountId, null); assert.ok(renderToStaticMarkup(f.render()).includes('Nightly could not reconnect'));
  f.failSignIn(false); f.value().connect(); await tick(); assert.equal(f.value().accountId, 'bob.testnet');
  f.failSignOut(true); await assert.rejects(f.value().disconnect(), /could not disconnect/); assert.equal(f.value().accountId, "bob.testnet");
  f.failSignOut(false); await f.value().disconnect(); assert.equal(f.value().accountId, null);
  f.failShow(true); f.value().connect(); assert.equal(f.value().isInitializing, false); assert.equal(f.value().selector !== null, true);
  f.failShow(false); f.value().connect(); assert.equal(f.shows, 2); cleanup(); assert.equal(f.subscriptions, 0); assert.equal(f.listeners, 0);

  const failed = fixture(); failed.value(); failed.effect(); await tick(); failed.value().connect(); failed.reject(); await tick();
  assert.equal(failed.value().isInitializing, false); assert.equal(failed.value().isConnecting, false); assert.equal(failed.value().selector, null);
  failed.value().connect(); assert.equal(failed.value().isConnecting, true); failed.effect(); await tick();
  assert.equal(failed.starts, 2); failed.complete(); await tick(); assert.equal(failed.shows, 1); assert.equal(failed.value().isInitializing, false);

  const abandoned = fixture(); abandoned.value(); const unmount = abandoned.effect(); await tick(); unmount(); abandoned.complete(); await tick();
  assert.equal(abandoned.subscriptions, 0); assert.equal(abandoned.value().selector, null);

  let wallet = { accountId: null, selector: null, modal: null, isInitializing: true, isConnecting: false, connect() {}, disconnect() {} };
  const settings = load("src/components/settings/SettingsPanel.tsx", {
    "../wallet/WalletProvider": { useWallet: () => wallet },
    "../../lib/near": { NEAR_NETWORK_ID: "testnet", NEAR_RPC_URL: "https://test.rpc.fastnear.com", ZINC_CONTRACT_ID: "zinc-builder-2026.testnet" },
    "next/link": { __esModule: true, default: ({ href, children, ...props }) => React.createElement("a", { href, ...props }, children) },
  });
  const markup = () => renderToStaticMarkup(React.createElement(settings.default));
  let html = markup(); assert.ok(html.includes("Checking saved wallet session")); assert.ok(html.includes("Preparing wallet selector"));
  wallet = { ...wallet, isConnecting: true }; html = markup(); assert.ok(html.includes("Opening wallet when ready")); assert.ok(html.includes('disabled=""'));
  wallet = { ...wallet, isInitializing: false, isConnecting: false }; html = markup(); assert.ok(html.includes("Wallet initialization unavailable")); assert.ok(html.includes("Retry wallet connection")); assert.ok(!html.includes("Initializing wallet connection..."));
  wallet = { ...wallet, selector: {}, modal: {} }; html = markup(); assert.ok(html.includes("Disconnected")); assert.ok(html.includes("Connect Wallet"));
  console.log("PASS: startup/ready/error states, queued connect, shared initialization, Strict Mode cleanup, account restoration/changes, rejected disconnect, modal retry, startup retry and Settings feedback. No real wallet or network transactions.");
})().catch((error) => { console.error(error); process.exitCode = 1; });
