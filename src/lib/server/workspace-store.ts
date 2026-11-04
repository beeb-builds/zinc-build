import "server-only";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createHash, randomBytes } from "node:crypto";

let database: DatabaseSync | undefined;
function db() {
  if (!database) {
    // Runtime private data must never be traced into the application bundle.
    const path = process.env.ZINC_WORKSPACE_DB === ":memory:" ? ":memory:" : resolve(/* turbopackIgnore: true */ process.env.ZINC_WORKSPACE_DB ?? "data/zinc-workspace.sqlite");
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    database = new DatabaseSync(path);
    database.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS challenges (id TEXT PRIMARY KEY, account TEXT NOT NULL, origin TEXT NOT NULL, nonce TEXT NOT NULL, message TEXT NOT NULL, expires INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, account TEXT NOT NULL, public_key TEXT NOT NULL, origin TEXT NOT NULL, expires INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS briefs (campaign INTEGER PRIMARY KEY, title TEXT NOT NULL, body TEXT NOT NULL, author TEXT NOT NULL, updated INTEGER NOT NULL, revision INTEGER NOT NULL);`);
  }
  return database;
}
export class WorkspaceError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export const opaqueToken = () => randomBytes(32).toString("hex");
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
export type Challenge = { id: string; account: string; origin: string; nonce: string; message: string; expires: number };
export function createChallenge(account: string, origin: string): Challenge {
  const expires = Date.now() + 5 * 60_000;
  const challenge = { id: opaqueToken(), account, origin, nonce: randomBytes(32).toString("base64"), expires,
    message: `Sign in to the Zinc campaign workspace.\nAccount: ${account}\nNetwork: NEAR Testnet\nOrigin: ${origin}\nExpires: ${new Date(expires).toISOString()}\nThis does not submit a transaction or authorize spending.` };
  const store = db();
  store.exec("BEGIN IMMEDIATE");
  try {
    store.prepare("DELETE FROM challenges WHERE expires <= ?").run(Date.now());
    store.prepare("DELETE FROM sessions WHERE expires <= ?").run(Date.now());
    const total = store.prepare("SELECT COUNT(*) AS count FROM challenges").get();
    const own = store.prepare("SELECT COUNT(*) AS count FROM challenges WHERE account = ?").get(account);
    if (Number(total?.count) >= 1000 || Number(own?.count) >= 5) throw new WorkspaceError(429, "Too many sign-in requests. Wait a few minutes before trying again.");
    store.prepare("INSERT INTO challenges VALUES (?, ?, ?, ?, ?, ?)").run(challenge.id, account, origin, challenge.nonce, challenge.message, expires);
    store.exec("COMMIT");
    return challenge;
  } catch (error) { store.exec("ROLLBACK"); throw error; }
}
export function consumeChallenge(id: string, account: string, origin: string): Challenge {
  const row = db().prepare("DELETE FROM challenges WHERE id = ? AND account = ? AND origin = ? AND expires > ? RETURNING *").get(id, account, origin, Date.now());
  if (!row) throw new WorkspaceError(401, "The sign-in challenge expired or was already used. Request a new signature.");
  return row as unknown as Challenge;
}
export function createSession(account: string, publicKey: string, origin: string) {
  const token = opaqueToken();
  db().prepare("INSERT INTO sessions VALUES (?, ?, ?, ?, ?)").run(hashToken(token), account, publicKey, origin, Date.now() + 15 * 60_000);
  return token;
}
export function readSession(token: string, origin: string) {
  return db().prepare("SELECT account, public_key FROM sessions WHERE token = ? AND origin = ? AND expires > ?").get(hashToken(token), origin, Date.now()) as { account: string; public_key: string } | undefined;
}
export function deleteSession(token: string) { db().prepare("DELETE FROM sessions WHERE token = ?").run(hashToken(token)); }
export type Brief = { title: string; body: string; author: string; updated: number; revision: number };
export function readBrief(campaign: number): Brief | null {
  return db().prepare("SELECT title, body, author, updated, revision FROM briefs WHERE campaign = ?").get(campaign) as unknown as Brief ?? null;
}
export function saveBrief(campaign: number, account: string, title: string, body: string, revision: number) {
  const store = db();
  store.exec("BEGIN IMMEDIATE");
  try {
    const current = readBrief(campaign);
    if ((current?.revision ?? 0) !== revision) throw new WorkspaceError(409, "This brief changed since you opened it. Reload it before saving again.");
    store.prepare("INSERT INTO briefs VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(campaign) DO UPDATE SET title=excluded.title, body=excluded.body, author=excluded.author, updated=excluded.updated, revision=excluded.revision")
      .run(campaign, title, body, account, Date.now(), revision + 1);
    store.exec("COMMIT");
  } catch (error) { store.exec("ROLLBACK"); throw error; }
}
