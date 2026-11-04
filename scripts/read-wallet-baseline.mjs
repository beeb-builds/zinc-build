// Read-only acceptance evidence. No credentials, wallet APIs or transaction submission.
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const maximum = (1n << 128n) - 1n;
function amount(value) {
  if (typeof value !== "string" || !/^\d+$/.test(value) || BigInt(value) > maximum) throw new Error("Invalid yoctoNEAR balance from RPC.");
  return value;
}
function account(value) {
  if (typeof value !== "string" || value.length < 2 || value.length > 64 || !/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/.test(value)) throw new Error("Use public NEAR account IDs only.");
  return value;
}
export async function readWalletBaseline({ rpcUrl, contractId, accounts }, transport = fetch) {
  if (!Array.isArray(accounts) || accounts.length < 1 || accounts.length > 2) throw new Error("Supply one or two public account IDs.");
  accounts.forEach(account);
  if (new Set(accounts).size !== accounts.length) throw new Error("Wallet A and wallet B must be different accounts.");
  async function rpc(method, params) {
    const response = await transport(rpcUrl, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: "zinc-read-only-qa", method, params }), signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`RPC HTTP ${response.status}`);
    const payload = await response.json();
    if (payload.error || !payload.result) throw new Error(`RPC read failed: ${payload.error?.message ?? "missing result"}`);
    return payload.result;
  }
  const block = await rpc("block", { finality: "final" });
  if (typeof block.header?.hash !== "string" || !Number.isSafeInteger(block.header.height)) throw new Error("Invalid finalized block.");
  const blockId = block.header.hash;
  async function view(method, args) {
    const result = await rpc("query", { request_type: "call_function", block_id: blockId, account_id: contractId,
      method_name: method, args_base64: Buffer.from(JSON.stringify(args)).toString("base64") });
    if (result.block_hash !== blockId || !Array.isArray(result.result)) throw new Error("RPC response is not from the requested finalized block.");
    return JSON.parse(Buffer.from(result.result).toString("utf8"));
  }
  const campaigns = await view("get_campaigns", {});
  if (!Array.isArray(campaigns)) throw new Error("Invalid campaign list.");
  const ids = new Set();
  const rows = [];
  // Keep request volume bounded to at most five concurrent reads for each campaign.
  for (const campaign of campaigns) {
    if (!Number.isSafeInteger(campaign?.id) || campaign.id < 0 || ids.has(campaign.id)) throw new Error("Invalid or duplicated campaign ID.");
    ids.add(campaign.id);
    const [rights, ...balances] = await Promise.all([
      view("get_campaign_rights", { campaign_id: campaign.id }),
      ...accounts.map(async (accountId) => {
        const [claimable, claimed] = await Promise.all([view("get_claimable", { campaign_id: campaign.id, account_id: accountId }), view("get_claimed", { campaign_id: campaign.id, account_id: accountId })]);
        return { accountId, claimableYocto: amount(claimable), claimedYocto: amount(claimed) };
      }),
    ]);
    if (!Array.isArray(rights) || !Array.isArray(campaign.contributors) || rights.length !== campaign.contributors.length || new Set(rights.map((right) => right.token_id)).size !== rights.length || rights.some((right) =>
      right.campaign_id !== campaign.id || !Number.isSafeInteger(right.contributor_index) || right.token_id !== `campaign:${campaign.id}:right:${right.contributor_index}` ||
      !campaign.contributors[right.contributor_index] || right.share_bps !== campaign.contributors[right.contributor_index].share_bps || typeof right.owner_id !== "string")) throw new Error("Incomplete or mismatched rights snapshot.");
    rows.push({ campaignId: campaign.id, name: campaign.name, startTimestampMs: campaign.start_timestamp_ms,
      endTimestampMs: campaign.end_timestamp_ms, totalDepositedYocto: amount(campaign.total_deposited_yocto),
      treasuryAccount: campaign.treasury_account, treasuryShareBps: campaign.treasury_share_bps, rights, balances });
  }
  return { capturedAt: new Date().toISOString(), readOnly: true, contractId, rpcUrl,
    block: { hash: blockId, height: block.header.height, timestampNanoseconds: block.header.timestamp_nanosec }, accounts, campaigns: rows };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const accounts = process.argv.slice(2);
    const config = await readFile(new URL("../src/lib/near.ts", import.meta.url), "utf8");
    const literal = (name) => { const value = new RegExp(`export const ${name} = "([^"]+)"`).exec(config)?.[1]; if (!value) throw new Error(`Missing ${name} configuration.`); return value; };
    if (literal("NEAR_NETWORK_ID") !== "testnet") throw new Error("This acceptance helper is restricted to Testnet.");
    const snapshot = await readWalletBaseline({ rpcUrl: literal("NEAR_RPC_URL"), contractId: literal("ZINC_CONTRACT_ID"), accounts });
    // Preserve each before/after snapshot instead of overwriting earlier evidence.
    const destination = new URL(`../data/wallet-acceptance-${snapshot.block.height}-${Date.now()}.json`, import.meta.url);
    await mkdir(new URL("../data/", import.meta.url), { recursive: true });
    await writeFile(destination, `${JSON.stringify(snapshot, null, 2)}\n`, { flag: "wx" });
    console.log(JSON.stringify({ path: fileURLToPath(destination), block: snapshot.block, accounts: snapshot.accounts,
      campaigns: snapshot.campaigns.map((campaign) => ({ campaignId: campaign.campaignId, name: campaign.name,
        totalDepositedYocto: campaign.totalDepositedYocto, balances: campaign.balances,
        testWalletRights: campaign.rights.filter((right) => accounts.includes(right.owner_id)) })) }, null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
