// Real signatures and SQLite; mocked NEAR reads. No network transactions.
const fs = require("fs"), ts = require("typescript"), vm = require("vm"), assert = require("node:assert/strict");
const compile = (file) => ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
(async () => {
  const near = await import("near-api-js"), nep413 = await import("near-api-js/nep413");
  const sqlite = require("node:sqlite");
  let clock = Date.now();
  class TestDate extends Date { static now() { return clock; } }
  const store = {};
  vm.runInNewContext(compile("src/lib/server/workspace-store.ts"), { exports: store, Buffer, Date: TestDate,
    process: { env: { ZINC_WORKSPACE_DB: ":memory:" } }, require: (id) => id === "server-only" ? {} : id === "node:sqlite" ? sqlite : require(id) });
  const origin = "https://zinc.example";
  const challenge = store.createChallenge("alice.testnet", origin);
  assert.equal(Buffer.from(challenge.nonce, "base64").length, 32);
  assert.throws(() => store.consumeChallenge(challenge.id, "bob.testnet", origin), /expired|used/);
  assert.throws(() => store.consumeChallenge(challenge.id, "alice.testnet", "https://evil.example"), /expired|used/);
  const consumed = store.consumeChallenge(challenge.id, "alice.testnet", origin);
  assert.throws(() => store.consumeChallenge(challenge.id, "alice.testnet", origin), /expired|used/);
  const expired = store.createChallenge("expired.testnet", origin); clock += 300001;
  assert.throws(() => store.consumeChallenge(expired.id, "expired.testnet", origin), /expired|used/);
  for (let i = 0; i < 5; i++) store.createChallenge("rate.testnet", origin);
  assert.throws(() => store.createChallenge("rate.testnet", origin), /Too many/);
  const token = store.createSession("alice.testnet", "ed25519:test", origin);
  assert.equal(store.readSession(token, origin).account, "alice.testnet");
  assert.equal(store.readSession(token, "https://evil.example"), undefined);
  clock += 900001; assert.equal(store.readSession(token, origin), undefined);
  store.saveBrief(6, "creator.testnet", "Private update", "Actual creator-authored test fixture", 0);
  assert.equal(store.readBrief(6).revision, 1);
  assert.throws(() => store.saveBrief(6, "creator.testnet", "Stale", "Old edit", 0), /changed/);
  assert.equal(store.readBrief(6).title, "Private update");

  const key = near.KeyPair.fromRandom("ed25519"), signer = new near.KeyPairSigner(key);
  let currentOwner = "alice.testnet", keyActive = true, failRpc = false;
  const reads = [], access = {};
  class Provider {
    async viewAccessKey(options) {
      if (!keyActive || !["alice.testnet", "creator.testnet"].includes(options.accountId) || options.publicKey.toString() !== key.getPublicKey().toString()) throw new Error("Unknown access key");
      return { permission: "FullAccess" };
    }
    async callFunction(options) {
      reads.push(options); if (failRpc) throw new Error("RPC unavailable");
      return options.method === "get_campaign" ? { id: 6, name: "Campaign", creator: "creator.testnet" } : [{ campaign_id: 6, owner_id: currentOwner }];
    }
  }
  vm.runInNewContext(compile("src/lib/server/workspace-access.ts"), { exports: access, Buffer,
    require: (id) => id === "server-only" ? {} : id === "near-api-js" ? { JsonRpcProvider: Provider } : id === "near-api-js/nep413" ? nep413 : id === "../near" ? { NEAR_RPC_URL: "mock://rpc", ZINC_CONTRACT_ID: "zinc.testnet" } : id === "./workspace-store" ? store : require(id) });
  const signed = await signer.signNep413Message("alice.testnet", { message: consumed.message, nonce: Buffer.from(consumed.nonce, "base64"), recipient: access.workspaceRecipient(origin) });
  await access.verifyWorkspaceSignature(consumed, signed.publicKey.toString(), Buffer.from(signed.signature).toString("base64"));
  await assert.rejects(access.verifyWorkspaceSignature({ ...consumed, origin: "https://evil.example" }, signed.publicKey.toString(), Buffer.from(signed.signature).toString("base64")));
  await assert.rejects(access.verifyWorkspaceSignature({ ...consumed, message: "Tampered message" }, signed.publicKey.toString(), Buffer.from(signed.signature).toString("base64")));
  await access.requireActiveKey("alice.testnet", signed.publicKey.toString()); keyActive = false;
  await assert.rejects(access.requireActiveKey("alice.testnet", signed.publicKey.toString())); keyActive = true;
  assert.equal((await access.authorizeWorkspace(6, "alice.testnet")).canEdit, false);
  currentOwner = "bob.testnet";
  await assert.rejects(access.authorizeWorkspace(6, "alice.testnet"), /currently owned/);
  assert.equal((await access.authorizeWorkspace(6, "bob.testnet")).canEdit, false);
  assert.equal((await access.authorizeWorkspace(6, "creator.testnet")).canEdit, true);
  await assert.rejects(access.authorizeWorkspace(6, "treasury.testnet"), /currently owned/);
  assert.ok(reads.every((read) => read.blockQuery.finality === "final"));
  failRpc = true; await assert.rejects(access.authorizeWorkspace(6, "bob.testnet"));
  failRpc = false; currentOwner = "alice.testnet";
  const next = require("next/server"), routes = {};
  vm.runInNewContext(compile("src/app/api/workspace/[action]/route.ts"), { exports: routes, Buffer, URL, require: (id) => id === "next/server" ? next : id.endsWith("workspace-access") ? access : id.endsWith("workspace-store") ? store : require(id) });
  async function call(action, input, cookie = "", requestOrigin = origin, method = "POST", extra = "") {
    const request = new next.NextRequest(`${origin}/api/workspace/${action}${extra}`, { method, headers: { origin: requestOrigin, cookie, "Content-Type": "application/json" }, ...(method === "POST" ? { body: JSON.stringify(input) } : {}) });
    return routes[method](request, { params: Promise.resolve({ action }) });
  }
  assert.equal((await call("challenge", { accountId: "alice.testnet" }, "", "https://evil.example")).status, 403);
  assert.equal((await call("resources", {}, "", origin, "GET", "?campaign_id=6&account_id=alice.testnet")).status, 401);
  const challengeResponse = await call("challenge", { accountId: "alice.testnet" });
  assert.equal(challengeResponse.status, 200);
  const challengeData = await challengeResponse.json();
  const challengeCookie = `zinc_workspace_challenge=${challengeResponse.cookies.get("zinc_workspace_challenge").value}`;
  const authSignature = await signer.signNep413Message("alice.testnet", { message: challengeData.message, nonce: Buffer.from(challengeData.nonce, "base64"), recipient: challengeData.recipient });
  const authData = { accountId: "alice.testnet", publicKey: authSignature.publicKey.toString(), signature: Buffer.from(authSignature.signature).toString("base64") };
  const authenticated = await call("auth", authData, challengeCookie);
  assert.equal(authenticated.status, 200);
  assert.equal((await call("auth", authData, challengeCookie)).status, 401);
  const sessionCookie = `zinc_workspace_session=${authenticated.cookies.get("zinc_workspace_session").value}`;
  let protectedResponse = await call("resources", {}, sessionCookie, origin, "GET", "?campaign_id=6&account_id=alice.testnet");
  assert.equal(protectedResponse.status, 200); assert.ok(protectedResponse.headers.get("cache-control").includes("no-store"));
  assert.equal((await protectedResponse.json()).brief.title, "Private update");
  assert.equal((await call("resources", {}, sessionCookie, origin, "GET", "?campaign_id=6&account_id=bob.testnet")).status, 401);
  assert.equal((await call("resources", { campaignId: "6", accountId: "alice.testnet", title: "Malicious edit", body: "Not the creator", revision: 1 }, sessionCookie)).status, 403);
  currentOwner = "bob.testnet";
  protectedResponse = await call("resources", {}, sessionCookie, origin, "GET", "?campaign_id=6&account_id=alice.testnet");
  assert.equal(protectedResponse.status, 403); assert.equal((await protectedResponse.json()).brief, undefined);
  const creatorToken = store.createSession("creator.testnet", key.getPublicKey().toString(), origin);
  const creatorCookie = `zinc_workspace_session=${creatorToken}`;
  assert.equal((await call("resources", { campaignId: "6", accountId: "creator.testnet", title: "Published", body: "Creator resource", revision: 1 }, creatorCookie)).status, 200);
  assert.equal(store.readBrief(6).revision, 2);
  assert.equal((await call("resources", { campaignId: "6", accountId: "creator.testnet", title: "Stale", body: "Old edit", revision: 1 }, creatorCookie)).status, 409);
  assert.equal((await call("resources", { campaignId: "6", accountId: "creator.testnet", title: "Big", body: "x".repeat(50000), revision: 2 }, creatorCookie)).status, 413);
  assert.equal((await call("logout", {}, creatorCookie)).status, 200);
  assert.equal(store.readSession(creatorToken, origin), undefined);
  console.log("PASS: real NEP-413 signatures, origin/message tampering, single-use/expiring challenges, rate limit, expiring origin-bound sessions, SQLite revisions, revoked keys, finalized holder transfer revocation, creator publishing role, treasury exclusion, and RPC fail-closed behavior. No network transactions sent.");
})().catch((error) => { console.error(error); process.exitCode = 1; });
