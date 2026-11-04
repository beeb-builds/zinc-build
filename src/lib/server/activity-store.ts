import "server-only";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { ZincActivity } from "../zinc-activity";
import { NEAR_NETWORK_ID, ZINC_CONTRACT_ID } from "../near";

let database: DatabaseSync | undefined;
function db() {
  if (!database) {
    const path = process.env.ZINC_ACTIVITY_DB === ":memory:" ? ":memory:" : resolve(/* turbopackIgnore: true */ process.env.ZINC_ACTIVITY_DB ?? "data/zinc-activity.sqlite");
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    database = new DatabaseSync(path);
    database.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS activity_transactions (scope TEXT NOT NULL, hash TEXT NOT NULL, signer TEXT NOT NULL, PRIMARY KEY(scope, hash));
      CREATE TABLE IF NOT EXISTS activity_rows (scope TEXT NOT NULL, id TEXT NOT NULL, campaign INTEGER, token TEXT, timestamp INTEGER NOT NULL, payload TEXT NOT NULL, PRIMARY KEY(scope, id));
      CREATE INDEX IF NOT EXISTS activity_time ON activity_rows(scope, timestamp DESC, id DESC);
      CREATE TABLE IF NOT EXISTS activity_budget (id INTEGER PRIMARY KEY CHECK(id = 1), minute INTEGER NOT NULL, count INTEGER NOT NULL);`);
  }
  return database;
}
const scope = `${NEAR_NETWORK_ID}:${ZINC_CONTRACT_ID}`;
export function hasActivityTransaction(hash: string, signer: string) {
  return !!db().prepare("SELECT hash FROM activity_transactions WHERE scope = ? AND hash = ? AND signer = ?").get(scope, hash, signer);
}
// A shared budget also bounds public RPC lookups across tabs and server processes.
export function takeActivityBudget() {
  const minute = Math.floor(Date.now() / 60_000);
  return !!db().prepare(`INSERT INTO activity_budget VALUES (1, ?, 1)
    ON CONFLICT(id) DO UPDATE SET minute = excluded.minute, count = CASE WHEN activity_budget.minute = excluded.minute THEN activity_budget.count + 1 ELSE 1 END
    WHERE activity_budget.minute != excluded.minute OR activity_budget.count < 30 RETURNING count`).get(minute);
}
export function saveActivityTransaction(hash: string, signer: string, rows: ZincActivity[]) {
  const store = db();
  store.exec("BEGIN IMMEDIATE");
  try {
    for (const row of rows) store.prepare("INSERT OR IGNORE INTO activity_rows VALUES (?, ?, ?, ?, ?, ?)")
      .run(scope, row.id, row.campaignId ?? null, row.tokenId ?? null, row.timestampMs ?? 0, JSON.stringify(row));
    store.prepare("INSERT OR IGNORE INTO activity_transactions VALUES (?, ?, ?)").run(scope, hash, signer);
    store.exec("COMMIT");
  } catch (error) { store.exec("ROLLBACK"); throw error; }
}
export function readSharedActivity(campaignId?: number, tokenId?: string, ownerAccount?: string): ZincActivity[] {
  return db().prepare(`SELECT payload FROM activity_rows WHERE scope = ? AND (? IS NULL OR campaign = ?) AND (? IS NULL OR token = ?)
    AND (? IS NULL OR (json_extract(payload, '$.kind') IN ('NFT Mints', 'NFT Transfers') AND (json_extract(payload, '$.from') = ? OR json_extract(payload, '$.to') = ?)))
    ORDER BY timestamp DESC, id DESC LIMIT 200`).all(scope, campaignId ?? null, campaignId ?? null, tokenId ?? null, tokenId ?? null, ownerAccount ?? null, ownerAccount ?? null, ownerAccount ?? null)
    .map((row) => JSON.parse(String(row.payload)) as ZincActivity);
}
