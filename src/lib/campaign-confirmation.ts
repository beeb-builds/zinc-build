import { ZINC_CONTRACT_ID } from "./near";
import { verifyExecution } from "./verify-transaction";

export type CampaignConfirmation = { campaignId: number | null; hash: string | null };

/** Missing return data must never turn a confirmed creation into an invitation to retry. */
export function campaignConfirmation(outcome: unknown): CampaignConfirmation {
  if (!outcome || typeof outcome !== "object" || !("transaction" in outcome) || !outcome.transaction ||
    typeof outcome.transaction !== "object" || !("receiver_id" in outcome.transaction) || outcome.transaction.receiver_id !== ZINC_CONTRACT_ID ||
    verifyExecution(outcome, false).state !== "confirmed") throw new Error("Campaign creation has not been confirmed.");
  const tx = outcome.transaction;
  const hash = "hash" in tx && typeof tx.hash === "string" && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(tx.hash) ? tx.hash : null;
  let campaignId: number | null = null;
  try {
    if ("status" in outcome && outcome.status && typeof outcome.status === "object" && "SuccessValue" in outcome.status && typeof outcome.status.SuccessValue === "string") {
      const bytes = Uint8Array.from(atob(outcome.status.SuccessValue), (char) => char.charCodeAt(0));
      const created: unknown = JSON.parse(new TextDecoder().decode(bytes));
      if (created && typeof created === "object" && "id" in created && typeof created.id === "number" && Number.isSafeInteger(created.id) && created.id >= 0) campaignId = created.id;
    }
  } catch { /* Keep the confirmed transaction even if the return data is unreadable. */ }
  return { campaignId, hash };
}
