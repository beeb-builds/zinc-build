import { ZINC_CONTRACT_ID } from "./near";
import { invalidateReadCache } from "./read-scheduler";

export type ActivityKind = "Campaigns" | "Deposits" | "Claims" | "NFT Transfers" | "NFT Mints";
export type ZincActivity = {
  id: string;
  kind: ActivityKind;
  account: string;
  campaignId?: number;
  campaignName?: string;
  amountYocto?: string;
  tokenId?: string;
  from?: string;
  to?: string;
  timestampMs?: number;
  hash?: string;
  source?: "rpc" | "wallet" | "state";
};
const KEY = `zinc:confirmed-activity:testnet:${ZINC_CONTRACT_ID}:v1`;
export const ACTIVITY_CHANGED = "zinc-activity-changed";

// This is a convenience cache of wallet confirmations, not a historical indexer.
export function readRecordedActivity(): ZincActivity[] {
  const value: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
  if (!Array.isArray(value)) throw new Error("Invalid saved activity.");
  return value.filter((row): row is ZincActivity => row && typeof row === "object" &&
    typeof row.id === "string" && typeof row.account === "string" &&
    ["Campaigns", "Deposits", "Claims", "NFT Transfers", "NFT Mints"].includes(row.kind) &&
    typeof row.hash === "string" && /^[1-9A-HJ-NP-Za-km-z]{32,64}$/.test(row.hash) &&
    (row.amountYocto === undefined || (typeof row.amountYocto === "string" && /^\d+$/.test(row.amountYocto))) &&
    (row.campaignId === undefined || (Number.isSafeInteger(row.campaignId) && row.campaignId >= 0)) &&
    [row.campaignName, row.tokenId, row.from, row.to].every((item) => item === undefined || typeof item === "string"));
}

type ConfirmedOutcome = {
  transaction: { hash: string; signer_id: string; receiver_id: string };
  status: unknown;
  transaction_outcome: { outcome: { status: unknown } };
  receipts_outcome: { outcome: { status: unknown } }[];
};

export function recordConfirmedActivity(outcome: ConfirmedOutcome | void, details: Omit<ZincActivity, "id" | "account" | "hash" | "timestampMs">) {
  // A post-transaction refresh must not join a read started before the write.
  invalidateReadCache();
  // Recording must never turn a successful financial action into a UI failure.
  try {
    if (!outcome || outcome.transaction.receiver_id !== ZINC_CONTRACT_ID ||
      typeof outcome.status !== "object" || outcome.status === null || !("SuccessValue" in outcome.status)) return;
    const statuses = [outcome.transaction_outcome.outcome.status, ...outcome.receipts_outcome.map((receipt) => receipt.outcome.status)];
    if (statuses.some((status) => typeof status === "object" && status !== null && "Failure" in status)) return;
    let previous: ZincActivity[];
    try { previous = readRecordedActivity(); } catch { previous = []; }
    const hash = outcome.transaction.hash;
    const row: ZincActivity = { ...details, id: hash, hash, account: outcome.transaction.signer_id };
    localStorage.setItem(KEY, JSON.stringify([row, ...previous.filter((entry) => entry.id !== hash)].slice(0, 100)));
  } catch { /* Storage may be disabled; the blockchain transaction is still confirmed. */ }
  if (outcome && typeof fetch === "function") {
    // Best effort only: shared history failure must never fail a confirmed payment.
    void publishActivityHash(outcome.transaction.hash, outcome.transaction.signer_id)
      .then(() => window.dispatchEvent(new Event(ACTIVITY_CHANGED))).catch(() => {});
  }
  try { window.dispatchEvent(new Event(ACTIVITY_CHANGED)); } catch { /* Recording stays non-blocking. */ }
}

export async function publishActivityHash(hash: string, signer: string) {
  const response = await fetch("/api/activity", { method: "POST", keepalive: true, headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ hash, signer }), signal: AbortSignal.timeout(30_000) });
  const data = await response.json();
  if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Activity could not be verified.");
}

export async function getSharedActivity(campaignId?: number, tokenId?: string | null, signal?: AbortSignal, ownerAccount?: string): Promise<ZincActivity[]> {
  const query = new URLSearchParams();
  if (campaignId !== undefined) query.set("campaign", String(campaignId));
  if (tokenId) query.set("token", tokenId);
  if (ownerAccount) query.set("owner", ownerAccount);
  const timeout = AbortSignal.timeout(15_000);
  const response = await fetch(`/api/activity?${query}`, { cache: "no-store", signal: signal ? AbortSignal.any([signal, timeout]) : timeout });
  if (!response.ok) throw new Error("Shared receipt history is unavailable. Browser confirmations and campaign records remain available.");
  const data = await response.json();
  if (!Array.isArray(data.rows)) throw new Error("Invalid shared activity response.");
  return data.rows.map((row: ZincActivity) => ({ ...row, source: "rpc" }));
}
