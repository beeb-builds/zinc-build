import "server-only";
import { NEAR_RPC_URL, ZINC_CONTRACT_ID } from "../near";
import { verifyExecution } from "../verify-transaction";
import { successfulClaimAmount } from "../claim-receipt";
import type { ZincActivity } from "../zinc-activity";

export class ActivityError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
function object(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function account(value: unknown): value is string { return typeof value === "string" && /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/.test(value) && value.length >= 2 && value.length <= 64; }
export function validActivityInput(hash: unknown, signer: unknown): hash is string {
  return typeof hash === "string" && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(hash) && account(signer);
}
function campaignId(value: unknown): number | undefined { return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : undefined; }
function tokenCampaign(token: string) { const match = /^campaign:(\d+):right:\d+$/.exec(token); return match ? campaignId(Number(match[1])) : undefined; }
function decode(value: unknown): unknown { if (typeof value !== "string") throw new Error("Invalid encoded result"); return JSON.parse(Buffer.from(value, "base64").toString("utf8")); }
async function rpc(method: string, params: Record<string, unknown>) {
  const response = await fetch(NEAR_RPC_URL, { method: "POST", cache: "no-store", signal: AbortSignal.timeout(12_000),
    headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: "zinc-history", method, params }) });
  if (!response.ok) throw new ActivityError(503, "NEAR RPC is unavailable. Try again later.");
  const data: unknown = await response.json();
  if (!object(data) || data.error || !object(data.result)) throw new ActivityError(422, "NEAR could not return this transaction. Check its hash and signer; older transactions may need an archival RPC.");
  return data.result;
}

/** Only RPC evidence supplies activity fields. Browser labels and amounts are never trusted. */
export async function verifyActivityTransaction(hash: string, signer: string): Promise<ZincActivity[]> {
  const outcome = await rpc("EXPERIMENTAL_tx_status", { tx_hash: hash, sender_account_id: signer, wait_until: "FINAL" });
  const tx = outcome.transaction;
  if (!object(tx) || tx.hash !== hash || tx.signer_id !== signer || tx.receiver_id !== ZINC_CONTRACT_ID || !Array.isArray(tx.actions) || tx.actions.length !== 1) {
    throw new ActivityError(422, "Use a single-call transaction signed by this account directly to the Zinc contract.");
  }
  const action = tx.actions[0];
  if (!object(action) || !object(action.FunctionCall)) throw new ActivityError(422, "This is not a Zinc function call.");
  const call = action.FunctionCall;
  const result = verifyExecution(outcome, call.method_name === "claim_revenue");
  if (outcome.final_execution_status !== "FINAL" || result.state !== "confirmed") throw new ActivityError(422, result.reason);
  let args: unknown;
  try { args = decode(call.args); } catch { throw new ActivityError(422, "Transaction arguments could not be decoded."); }
  if (!object(args)) throw new ActivityError(422, "Transaction arguments are invalid.");
  const receipts = outcome.receipts_outcome;
  if (!Array.isArray(receipts) || receipts.length > 500) throw new ActivityError(422, "Execution receipt evidence is unavailable or too large.");
  const txOutcome = outcome.transaction_outcome;
  if (!object(txOutcome) || typeof txOutcome.block_hash !== "string") throw new ActivityError(422, "Execution block is unavailable.");
  const block = await rpc("block", { block_id: txOutcome.block_hash });
  if (!object(block.header) || typeof block.header.timestamp_nanosec !== "string" || !/^\d+$/.test(block.header.timestamp_nanosec)) throw new ActivityError(422, "Execution timestamp is unavailable.");
  const timestampMs = Number(BigInt(block.header.timestamp_nanosec) / BigInt(1_000_000));
  if (!Number.isSafeInteger(timestampMs) || timestampMs < 0 || timestampMs > 8640000000000000) throw new ActivityError(422, "Invalid execution timestamp.");
  const rows: ZincActivity[] = [];
  const base = { account: signer, hash, timestampMs };
  const id = campaignId(args.campaign_id);
  if (call.method_name === "create_campaign" && object(outcome.status)) {
    let created: unknown;
    try { created = decode(outcome.status.SuccessValue); } catch { /* No reliable creation row. */ }
    if (object(created) && campaignId(created.id) !== undefined) rows.push({ ...base, id: `${hash}:create`, kind: "Campaigns", campaignId: campaignId(created.id) });
  } else if (call.method_name === "deposit_revenue" && id !== undefined && typeof call.deposit === "string" && /^\d+$/.test(call.deposit) && BigInt(call.deposit) > BigInt(0)) {
    rows.push({ ...base, id: `${hash}:deposit`, kind: "Deposits", campaignId: id, amountYocto: call.deposit });
  } else if (call.method_name === "claim_revenue" && id !== undefined) {
    const paid = successfulClaimAmount(outcome, signer);
    rows.push({ ...base, id: `${hash}:claim`, kind: "Claims", campaignId: id, ...(paid !== null ? { amountYocto: paid } : {}) });
  }
  for (const [receiptIndex, receipt] of receipts.entries()) {
    if (!object(receipt) || !object(receipt.outcome) || receipt.outcome.executor_id !== ZINC_CONTRACT_ID || !Array.isArray(receipt.outcome.logs)) continue;
    for (const [logIndex, log] of receipt.outcome.logs.entries()) {
      if (typeof log !== "string" || !log.startsWith("EVENT_JSON:") || log.length > 100_000) continue;
      let event: unknown;
      try { event = JSON.parse(log.slice("EVENT_JSON:".length)); } catch { continue; }
      if (!object(event) || event.standard !== "nep171" || !["nft_mint", "nft_transfer"].includes(String(event.event)) || !Array.isArray(event.data)) continue;
      for (const [dataIndex, data] of event.data.entries()) {
        if (!object(data) || !Array.isArray(data.token_ids) || !account(event.event === "nft_mint" ? data.owner_id : data.new_owner_id)) continue;
        if (event.event === "nft_transfer" && !account(data.old_owner_id)) continue;
        for (const [tokenIndex, token] of data.token_ids.entries()) {
          if (typeof token !== "string" || token.length > 256) continue;
          rows.push({ ...base, id: `${hash}:event:${receiptIndex}:${logIndex}:${dataIndex}:${tokenIndex}`, kind: event.event === "nft_mint" ? "NFT Mints" : "NFT Transfers",
            tokenId: token, campaignId: tokenCampaign(token), to: String(event.event === "nft_mint" ? data.owner_id : data.new_owner_id),
            ...(event.event === "nft_transfer" ? { from: String(data.old_owner_id) } : {}) });
        }
      }
    }
  }
  if (!rows.length || rows.length > 2000) throw new ActivityError(422, "No supported Zinc activity was found in this transaction.");
  return rows;
}
