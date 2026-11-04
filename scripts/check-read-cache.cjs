// Deterministic local cache checks. No RPC traffic or wallet transactions.
const fs = require("fs"), ts = require("typescript"), vm = require("vm"), assert = require("node:assert/strict");
const compile = (path) => ts.transpileModule(fs.readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const events = new EventTarget();
const api = {};
vm.runInNewContext(compile("src/lib/read-scheduler.ts"), { exports: api, window: events, Event });
(async () => {
  let time = 0, calls = 0;
  const cache = api.createReadScheduler(2, 100, 2, () => time);
  const read = async () => ++calls;
  const first = cache.schedule("alice", read);
  assert.equal(first, cache.schedule("alice", read));
  assert.equal(await first, 1);
  assert.equal(await cache.schedule("alice", read), 1); assert.equal(calls, 1);
  assert.equal(await cache.schedule("bob", read), 2); // Separate account key.
  await cache.schedule("alice", read); // Touch A, then C evicts B.
  await cache.schedule("carol", read);
  assert.equal(await cache.schedule("alice", read), 1);
  await cache.schedule("bob", read); assert.equal(calls, 4);
  time = 101;
  await cache.schedule("bob", read); assert.equal(calls, 5);
  await cache.schedule("bob", read, true); assert.equal(calls, 6);
  let release;
  const old = cache.schedule("race", () => new Promise((resolve) => { release = resolve; }));
  await Promise.resolve();
  cache.invalidate();
  assert.equal(await cache.schedule("race", async () => "new"), "new");
  release("old"); await old;
  assert.equal(await cache.schedule("race", async () => "wrong"), "new");
  await assert.rejects(cache.schedule("error", async () => { throw new Error("RPC"); }));
  assert.equal(await cache.schedule("error", async () => "recovered"), "recovered");
  let nullCalls = 0;
  await cache.schedule("missing", async () => { nullCalls++; return null; });
  await cache.schedule("missing", async () => { nullCalls++; return undefined; });
  assert.equal(nullCalls, 2);
  const queue = api.createReadScheduler(2);
  let active = 0, peak = 0;
  await Promise.all(Array.from({ length: 8 }, (_, index) => queue.schedule(String(index), async () => {
    active++; peak = Math.max(peak, active);
    await new Promise((resolve) => setImmediate(resolve)); active--; return index;
  })));
  assert.equal(peak, 2);

  // Exercise the actual contract adapter against a local mock transport.
  const helpers = {}, rpcCalls = [];
  let invalidAmount = false;
  vm.runInNewContext(compile("src/lib/zinc-contract.ts"), { exports: helpers, window: events, require: (id) => {
    if (id === "./read-scheduler") return api;
    if (id === "./near") return { NEAR_RPC_URL: "mock://rpc", NEAR_NETWORK_ID: "testnet", ZINC_CONTRACT_ID: "zinc.testnet" };
    if (id === "near-api-js") return { JsonRpcProvider: class { async callFunction(request) {
      rpcCalls.push(request);
      if (request.method === "get_claimable") return invalidAmount ? 1 : request.args.account_id === "alice.testnet" ? "1234567890123456789012345" : "2";
      if (request.method === "nft_token") return { token_id: request.args.token_id, owner_id: "alice.testnet" };
      if (request.method === "get_campaigns") return [];
      throw new Error("Unexpected mock RPC method");
    } } };
    throw new Error(`Unexpected dependency ${id}`);
  } });
  assert.equal(await helpers.getClaimable(6, "alice.testnet"), "1234567890123456789012345");
  await helpers.getClaimable(6, "alice.testnet"); assert.equal(rpcCalls.length, 1);
  assert.equal(await helpers.getClaimable(6, "bob.testnet"), "2"); assert.equal(rpcCalls.length, 2);
  await helpers.getNftToken("campaign:6:right:0"); await helpers.getNftToken("campaign:6:right:0");
  const beforeFresh = rpcCalls.length;
  await helpers.getNftToken("campaign:6:right:0", true); assert.equal(rpcCalls.length, beforeFresh + 1);
  invalidAmount = true; api.browserReads.invalidate();
  await assert.rejects(helpers.getClaimable(6, "alice.testnet"));
  invalidAmount = false;
  assert.equal(await helpers.getClaimable(6, "alice.testnet"), "1234567890123456789012345");

  // Focus and storage synchronization must not unmount an active signing form.
  const sync = {}, document = new EventTarget();
  document.visibilityState = "visible";
  let refreshes = 0, clock = 10000, cleanup;
  events.addEventListener(api.READS_INVALIDATED, () => refreshes++);
  vm.runInNewContext(compile("src/components/data/ReadCacheSync.tsx"), { exports: sync, window: events, document, Date: { now: () => clock }, require: (id) => {
    if (id === "react") return { useEffect: (effect) => { cleanup = effect(); } };
    if (id === "../../lib/read-scheduler") return api;
    if (id === "../../lib/near") return { ZINC_CONTRACT_ID: "zinc.testnet" };
    throw new Error(`Unexpected dependency ${id}`);
  } });
  sync.default();
  const finish = api.beginBrowserWrite(); events.dispatchEvent(new Event("focus")); assert.equal(refreshes, 0);
  finish(); clock += 1100;
  events.dispatchEvent(new Event("focus")); assert.equal(refreshes, 1);
  document.dispatchEvent(new Event("visibilitychange")); assert.equal(refreshes, 1);
  const storage = new Event("storage"); storage.key = "zinc:confirmed-activity:testnet:zinc.testnet:v1";
  events.dispatchEvent(storage); assert.equal(refreshes, 2);
  cleanup(); clock += 1100; events.dispatchEvent(new Event("focus")); assert.equal(refreshes, 2);
  console.log("PASS: cache reuse/expiry, LRU limit, account isolation, fresh ownership checks, invalidation races, retryable RPC errors, exact amounts, bounded concurrency, focus/storage refresh, and active-wallet protection. Mock transport only.");
})().catch((error) => { console.error(error); process.exitCode = 1; });
