import type { NextRequest } from "next/server";
import { readSharedActivity, hasActivityTransaction, saveActivityTransaction, takeActivityBudget } from "../../../lib/server/activity-store";
import { ActivityError, validActivityInput, verifyActivityTransaction } from "../../../lib/server/activity-verifier";
import { appOrigin } from "../../../lib/server/app-origin";

const headers = { "Cache-Control": "no-store" };
export async function GET(request: NextRequest) {
  const campaign = request.nextUrl.searchParams.get("campaign");
  const token = request.nextUrl.searchParams.get("token") ?? undefined;
  const owner = request.nextUrl.searchParams.get("owner") ?? undefined;
  if ((campaign !== null && (!/^\d+$/.test(campaign) || !Number.isSafeInteger(Number(campaign)))) || (token !== undefined && token.length > 256) ||
    (owner !== undefined && (owner.length < 2 || owner.length > 64 || !/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/.test(owner)))) return Response.json({ error: "Invalid activity filter." }, { status: 400, headers });
  try { return Response.json({ rows: readSharedActivity(campaign === null ? undefined : Number(campaign), token, owner), limit: 200 }, { headers }); }
  catch { return Response.json({ error: "Shared history is unavailable. Try again later." }, { status: 503, headers }); }
}
let active = 0;
export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== appOrigin(request)) return Response.json({ error: "Use the Zinc app to import a transaction." }, { status: 403, headers });
  let body: unknown;
  try {
    const reader = request.body?.getReader();
    if (!reader) throw new Error();
    const chunks: Uint8Array[] = []; let size = 0;
    while (true) {
      const { value, done } = await reader.read(); if (done) break;
      size += value.length;
      if (size > 2048) { await reader.cancel(); throw new Error(); }
      chunks.push(value);
    }
    body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch { return Response.json({ error: "Enter a transaction hash and signer (maximum request 2 KB)." }, { status: 400, headers }); }
  if (!body || typeof body !== "object" || !("hash" in body) || !("signer" in body) || !validActivityInput(body.hash, body.signer)) return Response.json({ error: "Enter a valid NEAR hash and signer account." }, { status: 400, headers });
  const hash = body.hash as string, signer = body.signer as string;
  let reserved = false;
  try {
    if (hasActivityTransaction(hash, signer)) return Response.json({ saved: true }, { headers });
    if (active >= 2 || !takeActivityBudget()) return Response.json({ error: "History verification is busy. Try again in a minute." }, { status: 429, headers });
    active++; reserved = true;
    const rows = await verifyActivityTransaction(hash, signer);
    saveActivityTransaction(hash, signer, rows);
    return Response.json({ saved: true }, { headers });
  } catch (error) {
    return Response.json({ error: error instanceof ActivityError ? error.message : "NEAR history verification is unavailable. Retry later." }, { status: error instanceof ActivityError ? error.status : 503, headers });
  } finally { if (reserved) active--; }
}
