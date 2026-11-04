// Exercise the installed official factory; no wallet approval or transaction.
const assert = require("node:assert/strict"), fs = require("node:fs"), vm = require("node:vm");
(async () => {
  const { patchSenderSource, patchInstalledSender } = await import("./patch-sender-mobile.mjs");
  patchInstalledSender();
  const original = "if (mobile) {\n      return null;\n    }";
  assert.equal(patchSenderSource(patchSenderSource(original)), patchSenderSource(original));
  assert.throws(() => patchSenderSource("changed source"), /changed upstream/);
  const source = fs.readFileSync(require.resolve("@near-wallet-selector/sender"), "utf8");
  async function check(mobile, near) {
    const api = {};
    vm.runInNewContext(source, { exports: api, window: { near }, require: (id) => id === "is-mobile" ? { isMobile: () => mobile } : require(id) });
    return api.setupSender()({});
  }
  assert.equal(await check(true, undefined), null);
  assert.equal(await check(true, { isSender: false }), null);
  const mobileSender = await check(true, { isSender: true });
  assert.equal(mobileSender.id, "sender"); assert.equal(mobileSender.metadata.available, true);
  assert.equal((await check(false, undefined)).metadata.available, false);
  assert.equal((await check(false, { isSender: true })).metadata.available, true);
  console.log("PASS: mobile Sender shown only with its NEAR provider; no-provider and desktop behavior preserved; patch is repeatable and version guarded.");
})().catch((error) => { console.error(error); process.exitCode = 1; });
