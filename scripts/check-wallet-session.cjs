// Real session/wrapper/journal boundaries with injected provider fixtures only.
const fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript'), assert = require('node:assert/strict');
const events = [], browser = { dispatchEvent(event) { events.push(event.type); } };
function load(file, overrides = {}) {
  const api = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { exports: api, window: browser, Event, Date, setTimeout, crypto, localStorage: { getItem: () => null, setItem() {} }, require: id => id in overrides ? overrides[id] : require(id) });
  return api;
}
const session = load('src/lib/wallet-session.ts');
const nightly = load('src/lib/nightly-connection.ts', { './wallet-session': session });
let connected = false, connects = 0, signs = 0, messages = 0, connectError = null, signError = null;
const account = { accountId: 'alice.testnet', publicKey: { toString: () => 'public-key' } };
const provider = { account, get isConnected() { return connected; }, async connect(callback) { connects++; if (connectError) throw connectError; connected = true; callback?.(account); return account; } };
browser.nightly = { near: provider };
let active = 'alice.testnet';
const selector = { store: { getState: () => ({ selectedWalletId: 'nightly', accounts: [{ active: true, accountId: active }] }) } };
const context = { store: selector.store, emitter: { emit() {} } };
const sent = { transaction: { hash: 'verified-fixture' } };
const factory = async () => ({ id: 'nightly', init: async () => ({
  // Reproduce upstream's cached-account shortcut, even while disconnected.
  signIn: async () => [account], getAccounts: async () => [account],
  signAndSendTransaction: async () => { signs++; if (signError) throw signError; return sent; },
  signAndSendTransactions: async () => { signs++; return [sent]; },
  signMessage: async () => { messages++; return { accountId: active }; },
}) });
(async () => {
  const walletModule = await nightly.withNightlyConnection(factory)({});
  const wallet = await walletModule.init(context);
  assert.throws(() => session.assertWalletSession(selector, active), e => e.code === 'ZINC_WALLET_NOT_SUBMITTED');
  assert.equal((await wallet.getAccounts()).length, 0, 'Do not restore a cached disconnected account');
  await assert.rejects(wallet.signAndSendTransaction({ signerId: active }), /No signing request was sent/);
  await assert.rejects(wallet.signMessage({}), /No signing request was sent/);
  assert.equal(signs, 0); assert.equal(messages, 0); assert.equal(connects, 0, 'No implicit connection prompt');
  await wallet.signIn({}); assert.equal(connects, 1, 'Reconnect despite upstream cached account');
  assert.equal(session.nightlySessionIssue(active), null);
  assert.equal(await wallet.signAndSendTransaction({ signerId: active }), sent);
  assert.equal(signs, 1);
  active = 'bob.testnet'; await assert.rejects(wallet.signAndSendTransaction({ signerId: active }), /account changed/); assert.equal(signs, 1);
  active = account.accountId;
  const unknown = new Error('Request failed'); signError = unknown;
  await assert.rejects(wallet.signAndSendTransaction({ signerId: active }), e => e === unknown);
  assert.equal(session.nightlySessionIssue(active), null, 'Generic errors must not invent a disconnect');
  signError = new Error('Not connected');
  await assert.rejects(wallet.signAndSendTransaction({ signerId: active }), /check Transaction recovery/);
  assert.ok(session.nightlySessionIssue(active));
  const after = signs;
  await assert.rejects(wallet.signAndSendTransaction({ signerId: active }), /No signing request was sent/);
  assert.equal(signs, after, 'No automatic retry after a lost connection');
  signError = null; await wallet.signIn({}); assert.equal(connects, 2); assert.equal(session.nightlySessionIssue(active), null);
  connected = false; connectError = { code: 4001 };
  await assert.rejects(wallet.signIn({}), /cancelled/); assert.ok(session.nightlySessionIssue(active));
  connectError = null; await wallet.signIn({});
  browser.nightly = { near: { ...provider } };
  assert.match(session.nightlySessionIssue(active), /Reload Zinc/);
  browser.nightly = { near: provider };
  session.assertWalletSession({ store: { getState: () => ({ selectedWalletId: 'sender' }) } }, 'unrelated.testnet');
  assert.ok(events.includes(session.WALLET_SESSION_CHANGED));

  // A pre-sign stop is persisted and retryable without deleting evidence.
  let stored = null;
  const journal = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/transaction-journal.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { exports: journal, crypto, window: browser, Event, localStorage: { getItem: () => stored, setItem: (_key, value) => { stored = value; } }, require: () => ({ NEAR_NETWORK_ID: 'testnet', ZINC_CONTRACT_ID: 'zinc-builder-2026.testnet' }) });
  const request = { accountId: active, method: 'claim_revenue', args: { campaign_id: 7 }, deposit: '0', kind: 'Claims', campaignId: 7 };
  const first = journal.beginTransactionAttempt(request);
  journal.updateTransactionAttempt(first.id, { state: 'not-submitted', reason: 'Stopped before signing' });
  journal.beginTransactionAttempt(request);
  assert.ok(journal.readTransactionAttempts().some(row => row.state === 'not-submitted'));
  assert.throws(() => journal.beginTransactionAttempt(request), /unresolved/, 'Actual unknown requests still block duplicates');
  console.log('PASS: cached disconnect, explicit reconnect/cancellation, account mismatch, unchanged payload/result, message guard, late disconnect, no resubmission, provider replacement, other wallets and retained retryable pre-sign records. No real wallet/network transactions.');
})().catch(error => { console.error(error); process.exitCode = 1; });
