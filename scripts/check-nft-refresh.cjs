// Component identity/state and asynchronous ownership fixtures. No wallet/network calls.
const fs = require("node:fs"), ts = require("typescript"), vm = require("node:vm");
const React = require("react"), assert = require("node:assert/strict");

(async () => {
  const near = await import("near-api-js");
  const banks = { parent: [], card: [] };
  let bank, cursor, effect, version = 0, tokens, writes = 0, freshReads = 0;
  const hooks = { ...React,
    useState(initial) {
      const index = cursor++;
      if (!(index in bank)) bank[index] = typeof initial === "function" ? initial() : initial;
      const target = bank;
      return [target[index], (next) => { target[index] = typeof next === "function" ? next(target[index]) : next; }];
    },
    useRef(initial) { const index = cursor++; return bank[index] ??= { current: initial }; },
    useEffect(callback) { effect = callback; },
  };
  const token = { token_id: "campaign:7:right:0", owner_id: "alice.testnet", metadata: {} };
  const right = { token_id: token.token_id, owner_id: token.owner_id, campaign_id: 7, contributor_index: 0, role: "Artist", share_bps: 6000 };
  tokens = async () => [token];
  let freshOwner = "alice.testnet";
  const rpc = {
    getAllNftTokensForOwner: () => tokens(), getCampaigns: async () => [],
    getRevenueRight: async () => right, getCampaignRights: async () => [],
    getNftToken: async (id, fresh) => { assert.equal(id, token.token_id); assert.equal(fresh, true); freshReads++; return { ...token, owner_id: freshOwner }; },
  };
  const stub = () => null;
  const overrides = {
    react: hooks, "near-api-js": near, "next/link": { __esModule: true, default: "a" },
    "../wallet/WalletProvider": { useWallet: () => ({ accountId: "alice.testnet", selector: {} }) },
    "../../lib/zinc-contract": rpc,
    "../data/useReadRefresh": { useReadRefresh: () => ({ version, refresh: () => { version++; } }) },
    "../../lib/zinc-write": {
      validateNftReceiver: (receiver) => { if (!receiver.trim()) throw new Error("Invalid receiver"); return receiver.trim(); },
      transferRevenueRightOnNear: async () => { writes++; return { transaction: { hash: "x" } }; },
    },
    "./RevenueRightCard": { __esModule: true, default: stub, rightHref: (id) => `/rights/${id}` },
    "../transactions/TransactionProgress": { __esModule: true, default: stub, useTransactionProgress: () => ({ progress: null, run: (fn) => fn(() => {}) }) },
    "../../lib/zinc-activity": { getSharedActivity: async () => [] },
    "../../lib/right-history": { previouslyHeldRightIds: () => new Set() },
    "../../lib/transaction-journal": { validTransactionHash: () => false },
    "./TransferReceipt": { __esModule: true, default: stub },
    "./TransferEarningsPreview": { __esModule: true, default: stub },
  };
  const api = {};
  const code = ts.transpileModule(fs.readFileSync("src/components/nfts/MyNfts.tsx", "utf8") + "\nexport { OwnedNfts };", {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(code, { exports: api, require: (id) => id in overrides ? overrides[id] : require(id), AbortController });
  function render(name, fn, props) { bank = banks[name]; cursor = 0; return fn(props); }
  const parent = () => render("parent", api.OwnedNfts, { accountId: "alice.testnet", selector: {} });
  function all(tree, predicate) {
    if (Array.isArray(tree)) return tree.flatMap((child) => all(child, predicate));
    if (!React.isValidElement(tree)) return [];
    return [...(predicate(tree) ? [tree] : []), ...all(tree.props.children, predicate)];
  }
  const card = (tree) => all(tree, (node) => node.type?.name === "NftCard")[0];
  const button = (tree, label) => all(tree, (node) => node.type === "button" && node.props.children === label)[0];
  const tick = () => new Promise(setImmediate);
  let tree = parent(); assert.equal(card(tree), undefined);
  let cleanup = effect(); await tick(); tree = parent();
  const original = card(tree); assert.ok(original); assert.equal(original.props.busy, false);
  let child = render("card", original.type, original.props);
  all(child, (node) => node.type === "input")[0].props.onChange({ target: { value: "bob.testnet" } });
  child = render("card", original.type, original.props);
  await all(child, (node) => node.type === "form")[0].props.onSubmit({ preventDefault() {} });
  child = render("card", original.type, original.props);
  assert.ok(button(child, "Confirm in wallet"));

  // A focus/cache refresh must retain the keyed card throughout its pending read.
  let release;
  tokens = () => new Promise((resolve) => { release = resolve; });
  cleanup(); version++; parent(); cleanup = effect(); tree = parent();
  let retained = card(tree);
  assert.equal(retained.type, original.type); assert.equal(retained.key, original.key);
  assert.equal(retained.props.busy, true);
  child = render("card", retained.type, retained.props);
  assert.equal(all(child, (node) => node.type === "input")[0].props.value, "bob.testnet");
  assert.equal(button(child, "Confirm in wallet").props.disabled, true);
  release([token]); await tick(); retained = card(parent());
  assert.equal(retained.key, original.key); assert.equal(retained.props.busy, false);
  child = render("card", retained.type, retained.props);
  assert.equal(button(child, "Confirm in wallet").props.disabled, false);

  // Failed refresh keeps the draft but must never enable confirmation from stale data.
  cleanup(); tokens = async () => { throw new Error("offline"); }; version++; parent(); cleanup = effect(); await tick();
  retained = card(parent()); assert.ok(retained); assert.equal(retained.props.busy, true);
  child = render("card", retained.type, retained.props);
  assert.equal(all(child, (node) => node.type === "input")[0].props.value, "bob.testnet");
  assert.equal(button(child, "Confirm in wallet").props.disabled, true);
  tokens = async () => [token]; cleanup(); version++; parent(); cleanup = effect(); await tick();
  retained = card(parent()); assert.equal(retained.props.busy, false);

  // Confirmation still reads fresh ownership; a stale owner can never reach signing.
  freshOwner = "bob.testnet";
  await assert.rejects(retained.props.onTransfer(token.token_id, "bob.testnet"), /no longer own/);
  assert.equal(freshReads, 1); assert.equal(writes, 0);
  tokens = async () => []; cleanup(); parent(); cleanup = effect(); await tick();
  assert.equal(card(parent()), undefined, "A right no longer owned must be removed after the fresh read");
  cleanup();

  const alice = api.default();
  overrides["../wallet/WalletProvider"].useWallet = () => ({ accountId: "bob.testnet", selector: {} });
  const bob = api.default();
  assert.notEqual(all(alice, (node) => node.type === api.OwnedNfts)[0].key, all(bob, (node) => node.type === api.OwnedNfts)[0].key,
    "Account changes must remount the portfolio so another account never inherits the draft");
  console.log("PASS: keyed transfer card/draft/review survive pending and failed refreshes, confirmation pauses until successful ownership refresh, stale-owner confirmation never signs, lost rights are removed, and account changes isolate drafts. Hook fixtures only; no wallet or network transactions.");
})().catch((error) => { console.error(error); process.exitCode = 1; });
