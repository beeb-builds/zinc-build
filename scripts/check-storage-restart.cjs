// Real on-disk SQLite across independent processes. Synthetic data only; no RPC.
const fs = require("node:fs"), os = require("node:os"), path = require("node:path");
const vm = require("node:vm"), ts = require("typescript"), assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");

function loadStore(file, env, near = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, { exports, Buffer, Date, process: { env },
    require: (id) => id === "server-only" ? {} : id === "../near" ? near : require(id) });
  return exports;
}

if (!process.env.ZINC_RESTART_FIXTURE) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "zinc-storage-restart-"));
  for (const phase of ["write", "read", "verify"]) {
    const result = spawnSync(process.execPath, [__filename, phase], {
      cwd: path.resolve(__dirname, ".."), encoding: "utf8", timeout: 30_000,
      env: { ...process.env, ZINC_RESTART_FIXTURE: directory },
    });
    assert.equal(result.error, undefined, result.error?.message);
    assert.equal(result.status, 0, `${phase}: ${result.stderr}\n${result.stdout}`);
  }
  assert.ok(fs.statSync(path.join(directory, "workspace.sqlite")).size > 0);
  assert.ok(fs.statSync(path.join(directory, "activity.sqlite")).size > 0);
  console.log(`PASS: briefs, sessions, one-use challenges, activity, exact amounts and shared lookup budget survive independent process restarts. Isolated files: ${directory}`);
} else {
  const directory = process.env.ZINC_RESTART_FIXTURE;
  const workspace = loadStore("src/lib/server/workspace-store.ts", { ZINC_WORKSPACE_DB: path.join(directory, "workspace.sqlite") });
  const config = { NEAR_NETWORK_ID: "testnet", ZINC_CONTRACT_ID: "isolated-storage-fixture.testnet" };
  const activity = loadStore("src/lib/server/activity-store.ts", { ZINC_ACTIVITY_DB: path.join(directory, "activity.sqlite") }, config);
  const origin = "https://isolated-zinc.example", account = "alice.testnet";
  const hash = "A".repeat(44), amount = "1000000000000000000000001";
  const phase = process.argv[2];
  if (phase === "write") {
    workspace.saveBrief(77, account, "Restart fixture", "Synthetic private text", 0);
    const token = workspace.createSession(account, "ed25519:fixture", origin);
    const challenge = workspace.createChallenge(account, origin);
    const minute = Math.floor(Date.now() / 60_000);
    assert.ok(activity.takeActivityBudget());
    activity.saveActivityTransaction(hash, account, [{ id: "fixture-deposit", kind: "Deposits", account, campaignId: 77, amountYocto: amount, timestampMs: 1, source: "rpc" }]);
    fs.writeFileSync(path.join(directory, "fixture.json"), JSON.stringify({ token, challenge, minute }));
  } else {
    const saved = JSON.parse(fs.readFileSync(path.join(directory, "fixture.json"), "utf8"));
    assert.equal(workspace.readBrief(77).body, "Synthetic private text");
    assert.equal(workspace.readBrief(77).revision, 1);
    assert.equal(workspace.readSession(saved.token, origin).account, account);
    assert.equal(workspace.readSession(saved.token, "https://wrong.example"), undefined);
    assert.equal(activity.readSharedActivity(77)[0].amountYocto, amount);
    assert.ok(activity.hasActivityTransaction(hash, account));
    assert.equal(activity.hasActivityTransaction(hash, "bob.testnet"), false);
    if (phase === "read") {
      assert.equal(workspace.consumeChallenge(saved.challenge.id, account, origin).id, saved.challenge.id);
      activity.saveActivityTransaction(hash, account, activity.readSharedActivity(77));
      assert.equal(activity.readSharedActivity(77).length, 1);
      assert.throws(() => workspace.saveBrief(77, account, "Stale", "Invalid", 0), /changed/);
    } else {
      assert.throws(() => workspace.consumeChallenge(saved.challenge.id, account, origin), /expired|used/);
      // Freeze the budget clock at its original minute to test restart persistence,
      // even when this check happens to cross a wall-clock minute boundary.
      class BudgetDate extends Date { static now() { return saved.minute * 60_000 + 1; } }
      const budget = {};
      const code = ts.transpileModule(fs.readFileSync("src/lib/server/activity-store.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
      vm.runInNewContext(code, { exports: budget, Date: BudgetDate, process: { env: { ZINC_ACTIVITY_DB: path.join(directory, "activity.sqlite") } }, require: (id) => id === "server-only" ? {} : id === "../near" ? config : require(id) });
      for (let i = 0; i < 29; i++) assert.ok(budget.takeActivityBudget());
      assert.equal(budget.takeActivityBudget(), false);
    }
  }
}
