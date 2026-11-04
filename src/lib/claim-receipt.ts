import { ZINC_CONTRACT_ID } from "./near";
import { verifyExecution } from "./verify-transaction";

function object(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }

/** Gross native payout only. Never substitute a pre-claim balance or include gas refunds. */
export function successfulClaimAmount(outcome: unknown, accountId: string): string | null {
  if (!object(outcome) || !object(outcome.transaction) || outcome.transaction.receiver_id !== ZINC_CONTRACT_ID ||
    outcome.transaction.signer_id !== accountId || verifyExecution(outcome, true).state !== "confirmed" ||
    !Array.isArray(outcome.receipts) || !Array.isArray(outcome.receipts_outcome)) return null;
  const seen = new Set<string>();
  let paid = BigInt(0);
  for (const receipt of outcome.receipts) {
    if (!object(receipt) || typeof receipt.receipt_id !== "string" || seen.has(receipt.receipt_id) || receipt.predecessor_id !== ZINC_CONTRACT_ID ||
      receipt.receiver_id !== accountId || !object(receipt.receipt) || !object(receipt.receipt.Action) || !Array.isArray(receipt.receipt.Action.actions)) continue;
    const execution = outcome.receipts_outcome.find((entry: unknown) => object(entry) && entry.id === receipt.receipt_id);
    if (!object(execution) || !object(execution.outcome) || execution.outcome.executor_id !== accountId || !object(execution.outcome.status) || typeof execution.outcome.status.SuccessValue !== "string") continue;
    seen.add(receipt.receipt_id);
    for (const action of receipt.receipt.Action.actions) if (object(action) && object(action.Transfer) && typeof action.Transfer.deposit === "string" && /^\d+$/.test(action.Transfer.deposit)) paid += BigInt(action.Transfer.deposit);
  }
  return paid > BigInt(0) ? paid.toString() : null;
}
