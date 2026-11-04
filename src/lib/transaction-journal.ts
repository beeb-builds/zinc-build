import { NEAR_NETWORK_ID, ZINC_CONTRACT_ID } from "./near";
import type { ActivityKind } from "./zinc-activity";

export type TransactionMethod = "create_campaign" | "deposit_revenue" | "claim_revenue" | "nft_transfer";
export type AttemptState = "waiting" | "unconfirmed" | "confirmed" | "failed";
export type TransactionAttempt = {
  id: string;
  accountId: string;
  method: TransactionMethod;
  args: Record<string, unknown>;
  deposit: string;
  kind: ActivityKind;
  campaignId?: number;
  campaignName?: string;
  tokenId?: string;
  to?: string;
  amountYocto?: string;
  startedAt: number;
  state: AttemptState;
  hash?: string;
  reason?: string;
};
export const JOURNAL_CHANGED = "zinc-transaction-journal";
const KEY = `zinc:transaction-attempts:${NEAR_NETWORK_ID}:${ZINC_CONTRACT_ID}:v1`;
const methods = ["create_campaign", "deposit_revenue", "claim_revenue", "nft_transfer"];
let fallback: TransactionAttempt[] = [];
let storageFailed = false;
export function recoveryStorageUnavailable() { return storageFailed; }
export function validTransactionHash(hash: string) { return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(hash); }

export function readTransactionAttempts(): TransactionAttempt[] {
  try {
    if (storageFailed) return fallback;
    const rows: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    if (!Array.isArray(rows)) throw new Error("Invalid transaction journal.");
    fallback = rows.filter((row): row is TransactionAttempt => row && typeof row === "object" &&
      typeof row.id === "string" && typeof row.accountId === "string" && methods.includes(row.method) &&
      ["waiting", "unconfirmed", "confirmed", "failed"].includes(row.state) &&
      typeof row.args === "object" && row.args !== null && !Array.isArray(row.args) &&
      typeof row.deposit === "string" && /^\d+$/.test(row.deposit) &&
      typeof row.startedAt === "number" && Number.isFinite(row.startedAt) && row.startedAt >= 0 && row.startedAt <= 8640000000000000 &&
      ["Campaigns", "Deposits", "Claims", "NFT Transfers"].includes(row.kind) &&
      (row.campaignId === undefined || (Number.isSafeInteger(row.campaignId) && row.campaignId >= 0)) &&
      [row.campaignName, row.tokenId, row.to, row.reason].every((value) => value === undefined || typeof value === "string") &&
      (row.amountYocto === undefined || (typeof row.amountYocto === "string" && /^\d+$/.test(row.amountYocto))) &&
      (row.hash === undefined || (typeof row.hash === "string" && validTransactionHash(row.hash))));
    return fallback;
  } catch { storageFailed = true; return fallback; }
}

function save(rows: TransactionAttempt[]) {
  fallback = rows;
  try { localStorage.setItem(KEY, JSON.stringify(rows)); }
  catch { storageFailed = true; }
  if (typeof window !== "undefined") window.dispatchEvent(new Event(JOURNAL_CHANGED));
}

export function beginTransactionAttempt(details: Omit<TransactionAttempt, "id" | "startedAt" | "state" | "hash" | "reason">) {
  const entry: TransactionAttempt = { ...details, id: crypto.randomUUID(), startedAt: Date.now(), state: "waiting" };
  const rows = readTransactionAttempts();
  if (rows.some((row) => row.accountId === details.accountId && row.method === details.method && row.deposit === details.deposit &&
    JSON.stringify(row.args) === JSON.stringify(details.args) && (row.state === "waiting" || row.state === "unconfirmed"))) {
    throw new Error("A matching request is unresolved. Use Transaction recovery to check wallet activity before submitting it again.");
  }
  // Keep unresolved attempts; bound only old resolved records.
  save([entry, ...rows.filter((row) => row.state === "waiting" || row.state === "unconfirmed"), ...rows.filter((row) => row.state === "confirmed" || row.state === "failed").slice(0, 19)]);
  return entry;
}

export function updateTransactionAttempt(id: string, update: Partial<Pick<TransactionAttempt, "state" | "hash" | "reason" | "campaignId">>) {
  save(readTransactionAttempts().map((row) => row.id === id ? { ...row, ...update } : row));
}

export function dismissTransactionAttempt(id: string) {
  save(readTransactionAttempts().filter((row) => row.id !== id));
}
