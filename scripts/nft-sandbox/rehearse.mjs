import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Sandbox, DEFAULT_ACCOUNT_ID, DEFAULT_PRIVATE_KEY } from 'near-sandbox';
import { Account, KeyPair, KeyPairSigner, JsonRpcProvider, actions, nearToYocto, yoctoToNear } from 'near-api-js';
import { writeReport } from './write-report.mjs';

// No RPC/network configuration is accepted from the environment or command line.
// Every account and key is created by this local sandbox; no wallet files are read.
const here = fileURLToPath(new URL('.', import.meta.url));
const artifacts = `${here}/artifacts`;
mkdirSync(artifacts, { recursive: true });
const json = (value) => JSON.stringify(value, (_, item) => typeof item === 'bigint' ? item.toString() : item, 2);
const persist = (name, value) => writeFileSync(`${artifacts}/${name}.json`, json(value));
const N = (value) => nearToYocto(value);
const T = (value) => BigInt(value) * 1_000_000_000_000n;
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const report = { framework: 'near-sandbox 0.3.4 + near-api-js 7.2.0', requestedNearcore: '2.14.0', localOnly: true, steps: [], transactions: {} };
let sandbox;

function measure(result) {
  const receipts = result.receipts_outcome ?? [];
  const totalGas = [result.transaction_outcome, ...receipts]
    .reduce((sum, receipt) => sum + BigInt(receipt?.outcome?.gas_burnt ?? 0), 0n);
  return {
    hash: result.transaction?.hash,
    finalExecutionStatus: result.final_execution_status,
    status: result.status,
    gas: totalGas.toString(),
    tgas: `${totalGas / 1_000_000_000_000n}.${(totalGas % 1_000_000_000_000n).toString().padStart(12, '0')}`,
    receipts: receipts.map((receipt) => ({ id: receipt.id, executor: receipt.outcome.executor_id,
      gas: String(receipt.outcome.gas_burnt), status: receipt.outcome.status,
      logs: receipt.outcome.logs, generatedReceiptIds: receipt.outcome.receipt_ids })),
  };
}

function assertSuccess(result) {
  assert(result.status && 'SuccessValue' in result.status, `Transaction failed: ${json(result.status)}`);
  for (const receipt of result.receipts_outcome ?? []) {
    assert(!('Failure' in receipt.outcome.status), `Receipt failed: ${json(receipt.outcome.status)}`);
  }
  assert.equal(result.final_execution_status, 'FINAL', 'All descendant/refund receipts must finish');
}

// Decode only the financial prefix shared by the deployed and NFT-era schemas.
// This verifies the entire claimed/pending map, not only selected public views.
function financialPrefix(bytes) {
  let offset = 0;
  const take = (length) => { const data = bytes.subarray(offset, offset + length); assert.equal(data.length, length); offset += length; return data; };
  const u32 = () => take(4).readUInt32LE();
  const u16 = () => take(2).readUInt16LE();
  const u64 = () => take(8).readBigUInt64LE().toString();
  const u128 = () => { const data = take(16); return (data.readBigUInt64LE() + (data.readBigUInt64LE(8) << 64n)).toString(); };
  const string = () => take(u32()).toString('utf8');
  const campaigns = [];
  const count = u32();
  for (let index = 0; index < count; index++) {
    const campaign = { id: u64(), creator: string(), name: string(), description: string(), start: u64(), end: u64() };
    campaign.contributors = Array.from({ length: u32() }, () => ({ role: string(), accountId: string(), bps: u16() }));
    campaign.treasury = string(); campaign.treasuryBps = u16(); campaign.createdAt = u64(); campaign.deposited = u128();
    campaigns.push(campaign);
  }
  const ledger = Array.from({ length: u32() }, () => ({ campaignId: u64(), accountId: string(), claimed: u128(), pending: u128() }));
  return { campaigns, ledger, bytesConsumed: offset };
}

async function run() {
  console.log('Starting LOCAL NEAR sandbox 2.14.0 (no testnet endpoint or credentials).');
  sandbox = await Sandbox.start({ version: '2.14.0' });
  const rpcUrl = new URL(sandbox.rpcUrl);
  assert(['127.0.0.1', 'localhost', '[::1]'].includes(rpcUrl.hostname), 'Refusing non-loopback RPC');
  const provider = new JsonRpcProvider({ url: rpcUrl.href });
  const node = await provider.viewNodeStatus();
  assert(!['mainnet', 'testnet'].includes(node.chain_id), 'Refusing a public NEAR network');
  assert(node.protocol_version >= 88, `Protocol ${node.protocol_version} cannot execute the SDK 5.30 artifact`);
  report.node = { version: node.version, protocolVersion: node.protocol_version, chainId: node.chain_id };
  console.log(`Local node ready: ${node.version.version}, protocol ${node.protocol_version}`);
  const root = new Account(DEFAULT_ACCOUNT_ID, provider, KeyPairSigner.fromSecretKey(DEFAULT_PRIVATE_KEY));
  async function createAccount(prefix, balance = '100') {
    const key = KeyPair.fromRandom('ed25519');
    const id = `${prefix}.${root.accountId}`;
    assert(!id.endsWith('.testnet'));
    const result = await root.signAndSendTransaction({ receiverId: id, waitUntil: 'FINAL', actions: [
      actions.createAccount(), actions.transfer(N(balance)), actions.addFullAccessKey(key.getPublicKey()),
    ] });
    assertSuccess(result);
    return new Account(id, provider, new KeyPairSigner(key));
  }
  const alice = await createAccount('alice');
  const bob = await createAccount('bob');
  const dev = await createAccount('developer');
  const promoter = await createAccount('promoter');
  const treasury = await createAccount('treasury');
  const depositor = await createAccount('depositor');
  const beneficiaries = [alice, bob, dev, promoter, treasury];
  const legacyCode = readFileSync(new URL('../../contracts/zinc-contract/target/near/zinc_pre_nft_rehearsal.wasm', import.meta.url));
  const nftCode = readFileSync(new URL('../../contracts/zinc-contract/target/near/zinc_contract.wasm', import.meta.url));
  report.artifacts = { legacy: { size: legacyCode.length, sha256: hash(legacyCode) }, nft: { size: nftCode.length, sha256: hash(nftCode) } };
  const block = await provider.viewBlock({ finality: 'final' });
  const now = Number(BigInt(block.header.timestamp_nanosec ?? block.header.timestamp) / 1_000_000n);

  async function transact(label, signer, contract, method, args = {}, deposit = 0n, gas = T(100)) {
    console.log(`Local transaction: ${label}`);
    const result = await signer.signAndSendTransaction({ receiverId: contract.accountId,
      actions: [actions.functionCall(method, args, gas, deposit)], waitUntil: 'FINAL' });
    persist(`receipt-${label}`, result);
    assertSuccess(result);
    report.transactions[label] = measure(result);
    return result;
  }
  const view = (contract, method, args = {}) => provider.callFunction({ contractId: contract.accountId, method, args, blockQuery: { finality: 'final' } });
  const state = (contract) => provider.viewAccount({ accountId: contract.accountId, blockQuery: { finality: 'final' } });
  async function rawState(contract) {
    const result = await provider.viewContractState({ contractId: contract.accountId, prefix: 'STATE', blockQuery: { finality: 'final' } });
    const item = result.values.find((entry) => Buffer.from(entry.key, 'base64').toString() === 'STATE');
    assert(item, 'Raw STATE missing');
    return Buffer.from(item.value, 'base64');
  }
  async function balances(contract) {
    const count = await view(contract, 'get_campaign_count');
    const data = [];
    for (let campaignId = 0; campaignId < count; campaignId++) {
      for (const beneficiary of beneficiaries) {
        data.push({ campaignId, accountId: beneficiary.accountId,
          claimable: await view(contract, 'get_claimable', { campaign_id: campaignId, account_id: beneficiary.accountId }),
          claimed: await view(contract, 'get_claimed', { campaign_id: campaignId, account_id: beneficiary.accountId }),
        });
      }
    }
    return data;
  }
  async function prepareFixture(prefix) {
    const contract = await createAccount(prefix, '50');
    const deployment = await contract.signAndSendTransaction({ receiverId: contract.accountId,
      actions: [actions.deployContract(legacyCode), actions.functionCall('new', {}, T(100), 0n)], waitUntil: 'FINAL' });
    assertSuccess(deployment);
    for (let index = 0; index < 2; index++) {
      await transact(`${prefix}-create-${index}`, root, contract, 'create_campaign', {
        name: `Sandbox Campaign ${index}`, description: 'Local upgrade rehearsal with real deposits and completed payout receipts.',
        start_timestamp_ms: now - 60_000, end_timestamp_ms: now + 86_400_000,
        contributors: [
          { role: 'Artist', account_id: alice.accountId, share_bps: 2500 },
          { role: 'Developer', account_id: dev.accountId, share_bps: 2000 },
          { role: 'Promoter', account_id: promoter.accountId, share_bps: 1500 },
        ], treasury_account: treasury.accountId, treasury_share_bps: 4000,
      });
      await transact(`${prefix}-deposit-${index}`, depositor, contract, 'deposit_revenue', { campaign_id: index }, N(index ? '8' : '10'));
    }
    const payout = await transact(`${prefix}-legacy-treasury-claim`, treasury, contract, 'claim_revenue', { campaign_id: 0 });
    assert.equal(Buffer.from(payout.status.SuccessValue, 'base64').toString(), 'true');
    assert.equal(await view(contract, 'get_claimed', { campaign_id: 0, account_id: treasury.accountId }), N('4').toString());
    assert.equal(await view(contract, 'get_claimable', { campaign_id: 0, account_id: alice.accountId }), N('2.5').toString());
    return contract;
  }

  // Main rehearsal: atomic upgrade + migration. Never call new() on upgraded state.
  const contract = await prepareFixture('zinc');
  const before = { campaigns: await view(contract, 'get_campaigns'), balances: await balances(contract), state: await state(contract) };
  const beforeRaw = await rawState(contract);
  const beforeFinancial = financialPrefix(beforeRaw);
  assert.equal(beforeFinancial.bytesConsumed, beforeRaw.length, 'Fixture must contain exactly the old schema');
  assert(beforeFinancial.ledger.some((entry) => BigInt(entry.claimed) > 0n && entry.pending === '0'));
  persist('before', { ...before, financialState: beforeFinancial, rawStateBase64: beforeRaw.toString('base64') });
  console.log('Atomic local NFT upgrade and migrate_nfts');
  const migration = await contract.signAndSendTransaction({ receiverId: contract.accountId,
    actions: [actions.deployContract(nftCode), actions.functionCall('migrate_nfts', {}, T(300), 0n)], waitUntil: 'FINAL' });
  persist('receipt-migration-atomic', migration);
  assertSuccess(migration);
  report.transactions.migrationAtomic = measure(migration);
  const after = { campaigns: await view(contract, 'get_campaigns'), balances: await balances(contract), state: await state(contract) };
  const afterRaw = await rawState(contract);
  const afterFinancial = financialPrefix(afterRaw);
  assert.deepEqual(afterFinancial, beforeFinancial);
  assert(afterRaw.subarray(0, beforeRaw.length).equals(beforeRaw), 'Financial Borsh prefix changed');
  assert.deepEqual(after.campaigns, before.campaigns);
  assert.deepEqual(after.balances, before.balances);
  assert.equal(await view(contract, 'get_campaign_count'), 2);
  assert.equal(await view(contract, 'nft_total_supply'), '6');
  assert.equal(await view(contract, 'nft_supply_for_owner', { account_id: treasury.accountId }), '0');
  const rights = [];
  for (const campaign of after.campaigns) {
    for (let index = 0; index < campaign.contributors.length; index++) {
      const tokenId = `campaign:${campaign.id}:right:${index}`;
      const token = await view(contract, 'nft_token', { token_id: tokenId });
      assert.equal(token.owner_id, campaign.contributors[index].account_id);
      const right = await view(contract, 'get_revenue_right', { token_id: tokenId });
      assert.equal(right.campaign_id, campaign.id);
      assert.equal(right.share_bps, campaign.contributors[index].share_bps);
      rights.push(right);
    }
  }
  persist('after-migration', { ...after, financialState: afterFinancial, rawStateBase64: afterRaw.toString('base64'), rights });
  report.preservation = { campaignCount: 2, campaignIds: after.campaigns.map((campaign) => campaign.id),
    financialPrefixByteIdentical: true, fullLedgerUnchanged: true, depositedTotalsUnchanged: true,
    claimedAndClaimableUnchangedForAllBeneficiaries: true, mintedNfts: 6, treasuryNfts: 0 };
  report.steps.push('Atomic NFT upgrade and migration preserved campaigns, deposits, entire claimed/pending ledger, and all beneficiary views.');

  // Replaying an initializer must fail without writing even one extra token.
  const replay = await contract.signAndSendTransaction({ receiverId: contract.accountId,
    actions: [actions.functionCall('migrate_nfts', {}, T(300), 0n)], waitUntil: 'FINAL', throwOnFailure: false });
  assert('Failure' in replay.status);
  assert(json(replay).includes('NFT schema migration already completed'));
  assert((await rawState(contract)).equals(afterRaw));
  assert.equal(await view(contract, 'nft_total_supply'), '6');
  persist('receipt-replay-rejected', replay);
  report.replayRejected = true;

  const tokenId = 'campaign:0:right:0';
  const historical = await view(contract, 'get_claimable', { campaign_id: 0, account_id: alice.accountId });
  assert.equal(historical, N('2.5').toString());
  await transact('nft-transfer-alice-bob', alice, contract, 'nft_transfer', { receiver_id: bob.accountId, token_id: tokenId, approval_id: null, memo: 'Local migration rehearsal' }, 1n);
  assert.equal((await view(contract, 'nft_token', { token_id: tokenId })).owner_id, bob.accountId);
  assert.equal(await view(contract, 'get_claimable', { campaign_id: 0, account_id: alice.accountId }), historical);
  assert.equal(await view(contract, 'get_claimable', { campaign_id: 0, account_id: bob.accountId }), '0');
  await transact('post-transfer-deposit', depositor, contract, 'deposit_revenue', { campaign_id: 0 }, N('10'));
  assert.equal(await view(contract, 'get_claimable', { campaign_id: 0, account_id: alice.accountId }), historical);
  assert.equal(await view(contract, 'get_claimable', { campaign_id: 0, account_id: bob.accountId }), N('2.5').toString());
  report.transfer = { tokenId, ownerBefore: alice.accountId, ownerAfter: bob.accountId, attachedYocto: '1',
    aliceHistoricalNear: '2.5', bobHistoricalNear: '0', aliceFromLaterDepositNear: '0', bobFromLaterDepositNear: '2.5' };
  for (const [label, beneficiary] of [['bob', bob], ['alice', alice]]) {
    const walletBefore = await state(beneficiary);
    const payout = await transact(`post-transfer-${label}-claim`, beneficiary, contract, 'claim_revenue', { campaign_id: 0 });
    assert.equal(Buffer.from(payout.status.SuccessValue, 'base64').toString(), 'true');
    const walletAfter = await state(beneficiary);
    assert(walletAfter.amount > walletBefore.amount + N('2.4'), 'Claim did not deliver real native NEAR');
    assert.equal(await view(contract, 'get_claimable', { campaign_id: 0, account_id: beneficiary.accountId }), '0');
    assert.equal(await view(contract, 'get_claimed', { campaign_id: 0, account_id: beneficiary.accountId }), N('2.5').toString());
    const callbackReceipt = payout.receipts_outcome.find((receipt) => receipt.outcome.executor_id === contract.accountId && receipt.outcome.status.SuccessValue === Buffer.from('true').toString('base64'));
    assert(callbackReceipt, 'Payout callback did not resolve successfully');
    report[`${label}Payout`] = { claimable: '0', claimedNear: '2.5', walletNetIncreaseNear: yoctoToNear(walletAfter.amount - walletBefore.amount), callbackGas: String(callbackReceipt.outcome.gas_burnt), allReceiptsFinal: true };
  }

  // Independent fixture measures migration alone, excluding deploy-action gas,
  // while the primary scenario above verifies the safer atomic production batch.
  const isolated = await prepareFixture('measure');
  const isolatedUpgrade = await isolated.signAndSendTransaction({ receiverId: isolated.accountId,
    actions: [actions.deployContract(nftCode)], waitUntil: 'FINAL' });
  assertSuccess(isolatedUpgrade);
  await transact('migration-only', isolated, isolated, 'migrate_nfts', {}, 0n, T(300));
  assert.equal(await view(isolated, 'nft_total_supply'), '6');
  assert.equal(await view(isolated, 'get_claimable', { campaign_id: 0, account_id: alice.accountId }), N('2.5').toString());

  const protocol = await provider.experimental_protocolConfig({ finality: 'final' });
  const storagePrice = BigInt(protocol.runtime_config.storage_amount_per_byte);
  const totalDeposited = beforeFinancial.campaigns.reduce((sum, campaign) => sum + BigInt(campaign.deposited), 0n);
  const settledClaims = beforeFinancial.ledger.reduce((sum, entry) => sum + BigInt(entry.claimed) - BigInt(entry.pending), 0n);
  const liabilities = totalDeposited - settledClaims;
  const finalStorageStake = BigInt(after.state.storage_usage) * storagePrice;
  const codeGrowth = nftCode.length - legacyCode.length;
  const storageGrowth = after.state.storage_usage - before.state.storage_usage;
  const gasPrice = BigInt((await provider.viewGasPrice()).gas_price);
  const gasBudget = T(300) * gasPrice + N('0.01');
  const minimum = liabilities + finalStorageStake + gasBudget;
  const recommended = ((minimum + N('1') + N('1') - 1n) / N('1')) * N('1');
  report.storage = { beforeBytes: before.state.storage_usage, afterBytes: after.state.storage_usage,
    totalGrowthBytes: storageGrowth, codeGrowthBytes: codeGrowth, stateGrowthBytes: storageGrowth - codeGrowth,
    byteCostYocto: storagePrice.toString(), extraStakeNear: yoctoToNear(BigInt(storageGrowth) * storagePrice),
    finalTotalStorageStakeNear: yoctoToNear(finalStorageStake) };
  report.balanceRecommendation = { fixtureOnly: true, outstandingBeneficiaryLiabilitiesNear: yoctoToNear(liabilities),
    maximumTransactionGasBudgetNear: yoctoToNear(gasBudget), calculatedPreMigrationFloorNear: yoctoToNear(minimum),
    recommendedTotalBalanceBeforeMigrationNear: yoctoToNear(recommended), marginNear: '1 (plus rounding up)',
    existingContractBalanceBeforeMigrationNear: yoctoToNear(before.state.amount),
    formula: 'live outstanding revenue + post-upgrade storage stake + transaction gas budget + at least 1 NEAR headroom; round up' };
  report.success = true;
  report.deploymentAssessment = 'Synthetic equivalent-state rehearsal passed. Live deployment still requires exact deployed state/code backup, funding/gas calculation for that snapshot, review, and explicit authorization.';
  persist('results', report);
  writeReport(report);
  console.log(json({ success: true, preservation: report.preservation, transfer: report.transfer,
    migrationTgas: report.transactions['migration-only'].tgas,
    atomicUpgradeTgas: report.transactions.migrationAtomic.tgas,
    storage: report.storage, balanceRecommendation: report.balanceRecommendation,
    evidence: 'artifacts/results.json and artifacts/REPORT.md' }));
}

try {
  await run();
} catch (error) {
  report.success = false;
  report.failure = { message: error.message, stack: error.stack };
  persist('results-failed', report);
  console.error(error);
  process.exitCode = 1;
} finally {
  if (sandbox) await sandbox.tearDown();
}
