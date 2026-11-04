import type { ZincActivity } from "./zinc-activity";

export type RightOwnershipEvent = {
  id: string;
  kind: "NFT Mints" | "NFT Transfers";
  from?: string;
  to: string;
  hash: string;
  timestampMs: number;
};

function account(value: unknown): value is string {
  return typeof value === "string" && value.length >= 2 && value.length <= 64 && /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/.test(value);
}

/** A list of observed events, never an inferred chain of ownership periods. */
export function rightOwnershipEvents(rows: ZincActivity[], tokenId: string): RightOwnershipEvent[] {
  const seen = new Set<string>();
  const events: RightOwnershipEvent[] = [];
  for (const row of rows) {
    if (row.tokenId !== tokenId || row.source !== "rpc" || !["NFT Mints", "NFT Transfers"].includes(row.kind) ||
      typeof row.id !== "string" || seen.has(row.id) || typeof row.hash !== "string" || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(row.hash) ||
      !account(row.to) || (row.kind === "NFT Transfers" && !account(row.from)) || typeof row.timestampMs !== "number" ||
      !Number.isSafeInteger(row.timestampMs) || row.timestampMs < 0 || row.timestampMs > 8640000000000000) continue;
    seen.add(row.id);
    events.push({ id: row.id, kind: row.kind as RightOwnershipEvent["kind"], to: row.to, hash: row.hash, timestampMs: row.timestampMs,
      ...(row.kind === "NFT Transfers" ? { from: row.from } : {}) });
  }
  // Events in the same transaction have the same timestamp. No intra-block order is inferred.
  return events.sort((a, b) => b.timestampMs - a.timestampMs || a.id.localeCompare(b.id));
}

/** Being the transaction signer alone is not proof of having owned the NFT. */
export function previouslyHeldRightIds(rows: ZincActivity[], accountId: string): Set<string> {
  const tokens = new Set<string>();
  for (const row of rows) {
    if (typeof row.tokenId !== "string" || !/^campaign:\d+:right:\d+$/.test(row.tokenId)) continue;
    if (rightOwnershipEvents([row], row.tokenId).some((event) => event.from === accountId || event.to === accountId)) tokens.add(row.tokenId);
  }
  return tokens;
}
