// Finalized-block read fixtures only. No credentials, wallet calls or network requests.
const assert = require("node:assert/strict");
(async () => {
  const { readWalletBaseline } = await import("./read-wallet-baseline.mjs");
  const accounts = ["alice.testnet", "bob.testnet"], exact = "900719925474099312345678901234";
  let calls, active, peak, invalidAmount, wrongBlock, duplicateCampaign, duplicateRight;
  function reset() { calls = []; active = 0; peak = 0; invalidAmount = false; wrongBlock = false; duplicateCampaign = false; duplicateRight = false; }
  const campaign = { id: 2, name: "Acceptance", start_timestamp_ms: 1000, end_timestamp_ms: 2000, total_deposited_yocto: exact,
    treasury_account: "treasury.testnet", treasury_share_bps: 4000, contributors: [{ role: "Artist", account_id: accounts[0], share_bps: 2500 }, { role: "Developer", account_id: "dev.testnet", share_bps: 3500 }] };
  const rights = campaign.contributors.map((contributor, index) => ({ campaign_id: 2, contributor_index: index, token_id: `campaign:2:right:${index}`, role: contributor.role, share_bps: contributor.share_bps, owner_id: contributor.account_id }));
  const config = { rpcUrl: "https://rpc.invalid", contractId: "zinc.testnet", accounts };
  async function transport(_url, options) {
    const request = JSON.parse(options.body); calls.push(request); active++; peak = Math.max(peak, active);
    await new Promise(setImmediate); active--;
    assert.ok(["block", "query"].includes(request.method), "No mutation RPC is permitted");
    let result;
    if (request.method === "block") {
      assert.equal(request.params.finality, "final");
      result = { header: { hash: "final-block", height: 100, timestamp_nanosec: "1000000000" } };
    } else {
      assert.equal(request.params.block_id, "final-block"); assert.equal(request.params.account_id, "zinc.testnet");
      assert.equal(request.params.request_type, "call_function");
      const args = JSON.parse(Buffer.from(request.params.args_base64, "base64").toString());
      let value;
      if (request.params.method_name === "get_campaigns") value = duplicateCampaign ? [campaign, campaign] : [campaign];
      else {
        assert.equal(args.campaign_id, 2);
        if (request.params.method_name === "get_campaign_rights") value = duplicateRight ? [rights[0], rights[0]] : rights;
        else { assert.ok(accounts.includes(args.account_id)); assert.ok(["get_claimable", "get_claimed"].includes(request.params.method_name)); value = invalidAmount ? "0.1" : args.account_id === accounts[0] ? exact : "0"; }
      }
      result = { block_hash: wrongBlock ? "other-block" : "final-block", result: [...Buffer.from(JSON.stringify(value))] };
    }
    return { ok: true, json: async () => ({ result }) };
  }
  reset(); const snapshot = await readWalletBaseline(config, transport);
  assert.equal(snapshot.readOnly, true); assert.equal(snapshot.block.hash, "final-block");
  assert.equal(snapshot.campaigns[0].totalDepositedYocto, exact); assert.equal(snapshot.campaigns[0].balances[0].claimableYocto, exact);
  assert.equal(snapshot.campaigns[0].balances[1].claimedYocto, "0"); assert.equal(snapshot.campaigns[0].rights[0].owner_id, accounts[0]);
  assert.equal(calls.length, 7); assert.ok(peak <= 5);
  reset(); await assert.rejects(readWalletBaseline({ ...config, accounts: [accounts[0], accounts[0]] }, transport), /different/); assert.equal(calls.length, 0);
  reset(); await assert.rejects(readWalletBaseline({ ...config, accounts: ["NOT AN ACCOUNT"] }, transport), /public NEAR/); assert.equal(calls.length, 0);
  reset(); wrongBlock = true; await assert.rejects(readWalletBaseline(config, transport), /finalized block/);
  reset(); invalidAmount = true; await assert.rejects(readWalletBaseline(config, transport), /yoctoNEAR/);
  reset(); duplicateCampaign = true; await assert.rejects(readWalletBaseline(config, transport), /duplicated campaign/);
  reset(); duplicateRight = true; await assert.rejects(readWalletBaseline(config, transport), /rights snapshot/);
  reset(); await assert.rejects(readWalletBaseline(config, async () => ({ ok: false, status: 503 })), /HTTP 503/);
  console.log("PASS: one finalized block across all reads, exact large/zero balances, two distinct public wallets, bounded concurrency, duplicate/incomplete data rejection, HTTP failures and read-only RPC allowlist. No network transactions.");
})().catch((error) => { console.error(error); process.exitCode = 1; });
