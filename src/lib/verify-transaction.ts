import { ZINC_CONTRACT_ID } from "./near";
import type { TransactionAttempt } from "./transaction-journal";

function object(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null; }
function same(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((value, index) => same(value, b[index]));
  if (!object(a) || !object(b) || Array.isArray(a) || Array.isArray(b)) return false;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((key) => Object.hasOwn(b, key) && same(a[key], b[key]));
}
export type ExecutionResult = { state: "confirmed" | "failed" | "unconfirmed"; reason: string };

/** Validate recovery against actual transaction inputs, never a supplied hash alone. */
export function verifyAttemptIdentity(outcome: unknown, attempt: TransactionAttempt, hash: string) {
  if (!object(outcome) || !object(outcome.transaction)) throw new Error("Transaction details are not available yet.");
  const tx = outcome.transaction;
  if (tx.hash !== hash || tx.signer_id !== attempt.accountId || tx.receiver_id !== ZINC_CONTRACT_ID || !Array.isArray(tx.actions) || tx.actions.length !== 1) {
    throw new Error("This transaction does not match the saved signer and Zinc contract request.");
  }
  const action: unknown = tx.actions[0];
  if (!object(action) || !object(action.FunctionCall)) throw new Error("This is not the saved Zinc function call.");
  const call = action.FunctionCall;
  let args: unknown;
  try { args = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(String(call.args)), (char) => char.charCodeAt(0)))); }
  catch { throw new Error("Transaction arguments could not be verified."); }
  if (call.method_name !== attempt.method || call.deposit !== attempt.deposit || !same(args, attempt.args)) {
    throw new Error("The method, amount, or arguments do not match this saved attempt.");
  }
}

export function verifyExecution(outcome: unknown, claim: boolean): ExecutionResult {
  if (!object(outcome) || !object(outcome.transaction_outcome) || !object(outcome.transaction_outcome.outcome) || !Array.isArray(outcome.receipts_outcome)) {
    return { state: "unconfirmed", reason: "Execution receipts are unavailable. Check wallet activity before retrying." };
  }
  const statuses = [outcome.status, outcome.transaction_outcome.outcome.status, ...outcome.receipts_outcome.map((receipt: unknown) => object(receipt) && object(receipt.outcome) ? receipt.outcome.status : undefined)];
  if (statuses.some((status) => status === "Failure" || (object(status) && "Failure" in status))) {
    return { state: "failed", reason: "The transaction or a receipt failed on NEAR. Refresh balances and inspect its explorer details." };
  }
  if (!object(outcome.status) || typeof outcome.status.SuccessValue !== "string" || statuses.slice(1).some((status) => !object(status) || !("SuccessValue" in status || "SuccessReceiptId" in status))) {
    return { state: "unconfirmed", reason: "NEAR has not returned a completed execution result. Check again before retrying." };
  }
  if (claim) {
    let result: unknown;
    try { result = JSON.parse(atob(outcome.status.SuccessValue)); } catch { /* Remain unconfirmed. */ }
    if (result === false) return { state: "failed", reason: "The payout callback reported failure. Refresh claimable revenue before retrying." };
    if (result !== true) return { state: "unconfirmed", reason: "A successful payout callback has not been verified." };
  }
  return { state: "confirmed", reason: claim ? "Payout callback confirmed on NEAR." : "Transaction confirmed on NEAR." };
}
