const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const source = fs.readFileSync('src/lib/near.ts', 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
function config(env) {
  const exports = {};
  vm.runInNewContext(compiled, { exports, process: { env } });
  return exports;
}
assert.equal(config({}).ZINC_CONTRACT_ID, 'zinc-builder-2026.testnet');
const fresh = config({ NEXT_PUBLIC_ZINC_CONTRACT_ID: 'zinc-demo-2026.testnet' });
assert.equal(fresh.ZINC_CONTRACT_ID, 'zinc-demo-2026.testnet');
assert.equal(fresh.NEAR_NETWORK_ID, 'testnet');
assert.equal(fresh.NEAR_RPC_URL, config({}).NEAR_RPC_URL);
console.log('PASS: default contract preserved; fresh deployment override uses the same Testnet network and RPC. No transactions.');
