// Proxy-origin regression: configured public origin wins; untrusted headers do not.
const fs = require("node:fs"), vm = require("node:vm"), assert = require("node:assert/strict"), ts = require("typescript");
const env = {}, api = {};
const code = ts.transpileModule(fs.readFileSync("src/lib/server/app-origin.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
vm.runInNewContext(code, { exports: api, URL, process: { env }, require: () => ({}) });
const request = { url: "http://localhost:8080/api/workspace/challenge", headers: new Headers({ "x-forwarded-host": "evil.example" }) };
assert.equal(api.appOrigin(request), "http://localhost:8080");
env.ZINC_PUBLIC_ORIGIN = "https://zinc.example";
assert.equal(api.appOrigin(request), "https://zinc.example");
assert.notEqual(api.appOrigin(request), "https://evil.example");
env.ZINC_PUBLIC_ORIGIN = "https://zinc.example/";
assert.equal(api.appOrigin(request), "https://zinc.example");
for (const invalid of ["invalid", "https://zinc.example/path", "https://user:pass@zinc.example", "ftp://zinc.example", "https://zinc.example?query=1"]) {
  env.ZINC_PUBLIC_ORIGIN = invalid;
  assert.throws(() => api.appOrigin(request));
}
console.log("PASS: public deployment origin, local fallback, spoofed proxy headers and invalid configuration.");
