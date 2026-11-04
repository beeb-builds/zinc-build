import { JsonRpcProvider } from "near-api-js";
import { NEAR_RPC_URL } from "./near";
import { readTransactionAttempts, updateTransactionAttempt, validTransactionHash, type TransactionAttempt } from "./transaction-journal";
import { verifyAttemptIdentity, verifyExecution } from "./verify-transaction";
import { recordConfirmedActivity } from "./zinc-activity";
import { campaignConfirmation } from "./campaign-confirmation";

const provider = new JsonRpcProvider({ url: NEAR_RPC_URL });

export async function recoverTransaction(attempt: TransactionAttempt, hashInput: string) {
  const hash = hashInput.trim();
  if (!validTransactionHash(hash)) throw new Error("Enter a valid NEAR transaction hash from wallet activity or the explorer.");
  if (readTransactionAttempts().some((row) => row.id !== attempt.id && row.hash === hash)) {
    throw new Error("That hash is already linked to another saved attempt. Check the explorer before choosing a different hash.");
  }
  // Status lookup only. This module never signs or resubmits transactions.
  const outcome = await provider.viewTransactionStatus({ txHash: hash, accountId: attempt.accountId, waitUntil: "FINAL" });
  verifyAttemptIdentity(outcome, attempt, hash);
  if (outcome.final_execution_status !== "FINAL") {
    updateTransactionAttempt(attempt.id, { hash, state: "unconfirmed", reason: "NEAR has not finalized all receipts yet. Check again shortly." });
    return;
  }
  const result = verifyExecution(outcome, attempt.method === "claim_revenue");
  // Only the verified creation return value can identify the new campaign.
  const campaignId = attempt.method === "create_campaign"
    ? (result.state === "confirmed" ? campaignConfirmation(outcome).campaignId ?? undefined : undefined)
    : attempt.campaignId;
  updateTransactionAttempt(attempt.id, { hash, ...result, campaignId });
  if (result.state === "confirmed") {
    recordConfirmedActivity(outcome, { kind: attempt.kind, campaignId, campaignName: attempt.campaignName,
      amountYocto: attempt.amountYocto, tokenId: attempt.tokenId, from: attempt.method === "nft_transfer" ? attempt.accountId : undefined, to: attempt.to });
  }
}
