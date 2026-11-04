import { ZINC_CONTRACT_ID } from "./near";
import { verifyExecution } from "./verify-transaction";

function object(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }

/** Missing evidence stays unknown; it must not be replaced with the amount typed in the form. */
export function successfulDepositAmount(outcome: unknown, campaignId: number, accountId: string, expectedYocto: string): string | null {
  try {
    if (!object(outcome) || !object(outcome.transaction) || outcome.transaction.receiver_id !== ZINC_CONTRACT_ID || outcome.transaction.signer_id !== accountId ||
      verifyExecution(outcome, false).state !== "confirmed" || !Array.isArray(outcome.transaction.actions) || outcome.transaction.actions.length !== 1) return null;
    const action = outcome.transaction.actions[0];
    if (!object(action) || !object(action.FunctionCall)) return null;
    const call = action.FunctionCall;
    if (call.method_name !== "deposit_revenue" || typeof call.deposit !== "string" || !/^\d+$/.test(call.deposit) ||
      BigInt(call.deposit) <= BigInt(0) || call.deposit !== expectedYocto || typeof call.args !== "string") return null;
    const bytes = Uint8Array.from(atob(call.args), (char) => char.charCodeAt(0));
    const args: unknown = JSON.parse(new TextDecoder().decode(bytes));
    return object(args) && args.campaign_id === campaignId ? call.deposit : null;
  } catch { return null; }
}
