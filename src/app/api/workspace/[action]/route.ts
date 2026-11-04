import { NextRequest, NextResponse } from "next/server";
import { authorizeWorkspace, requireActiveKey, verifyWorkspaceSignature, workspaceRecipient } from "../../../../lib/server/workspace-access";
import { consumeChallenge, createChallenge, createSession, deleteSession, readBrief, readSession, saveBrief, WorkspaceError } from "../../../../lib/server/workspace-store";
import { appOrigin } from "../../../../lib/server/app-origin";

const SESSION = "zinc_workspace_session", CHALLENGE = "zinc_workspace_challenge";
type Context = { params: Promise<{ action: string }> };
function json(data: unknown, status = 200) { return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store, private", Vary: "Cookie" } }); }
function cookieOptions(request: NextRequest, maxAge: number) { return { httpOnly: true, sameSite: "strict" as const, secure: new URL(origin(request)).protocol === "https:", path: "/api/workspace", maxAge }; }
function origin(request: NextRequest) { return appOrigin(request); }
function account(value: unknown): string {
  if (typeof value !== "string" || value.length < 2 || value.length > 64 || !/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/.test(value)) throw new WorkspaceError(400, "A valid NEAR account is required.");
  return value;
}
function campaign(value: unknown): number {
  if (typeof value !== "string" || !/^\d+$/.test(value) || !Number.isSafeInteger(Number(value))) throw new WorkspaceError(400, "A valid campaign ID is required.");
  return Number(value);
}
async function body(request: NextRequest): Promise<Record<string, unknown>> {
  if (request.headers.get("origin") !== origin(request)) throw new WorkspaceError(403, "This request must come from the Zinc app on the same origin.");
  if (!request.headers.get("content-type")?.startsWith("application/json")) throw new WorkspaceError(415, "JSON is required.");
  const reader = request.body?.getReader();
  if (!reader) throw new WorkspaceError(400, "A request body is required.");
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) {
    const part = await reader.read(); if (part.done) break;
    size += part.value.byteLength;
    if (size > 48_000) { await reader.cancel(); throw new WorkspaceError(413, "This workspace request is too large."); }
    chunks.push(part.value);
  }
  try { const value: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8")); if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error(); return value as Record<string, unknown>; }
  catch { throw new WorkspaceError(400, "Invalid JSON request."); }
}
async function session(request: NextRequest, expectedAccount: unknown) {
  const token = request.cookies.get(SESSION)?.value;
  const value = token ? readSession(token, origin(request)) : undefined;
  if (!value || value.account !== account(expectedAccount)) throw new WorkspaceError(401, "Sign a wallet message to open this workspace.");
  await requireActiveKey(value.account, value.public_key);
  return value;
}
function errorResponse(error: unknown) { return error instanceof WorkspaceError ? json({ error: error.message }, error.status) : json({ error: "The workspace could not verify access or read its storage. Please retry shortly." }, 503); }

export async function GET(request: NextRequest, { params }: Context) {
  try {
    if ((await params).action !== "resources") return json({ error: "Not found." }, 404);
    const id = campaign(request.nextUrl.searchParams.get("campaign_id"));
    const user = await session(request, request.nextUrl.searchParams.get("account_id"));
    const access = await authorizeWorkspace(id, user.account);
    return json({ ...access, brief: readBrief(id) });
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: NextRequest, { params }: Context) {
  try {
    const input = await body(request), action = (await params).action;
    if (action === "challenge") {
      const challenge = createChallenge(account(input.accountId), origin(request));
      const response = json({ message: challenge.message, nonce: challenge.nonce, recipient: workspaceRecipient(challenge.origin) });
      response.cookies.set(CHALLENGE, challenge.id, cookieOptions(request, 300)); return response;
    }
    if (action === "auth") {
      const challenge = consumeChallenge(request.cookies.get(CHALLENGE)?.value ?? "", account(input.accountId), origin(request));
      if (typeof input.publicKey !== "string" || typeof input.signature !== "string") throw new WorkspaceError(400, "A signed wallet message is required.");
      await verifyWorkspaceSignature(challenge, input.publicKey, input.signature);
      const old = request.cookies.get(SESSION)?.value; if (old) deleteSession(old);
      const response = json({ authenticated: true });
      response.cookies.set(SESSION, createSession(challenge.account, input.publicKey, origin(request)), cookieOptions(request, 900));
      response.cookies.set(CHALLENGE, "", cookieOptions(request, 0)); return response;
    }
    if (action === "logout") {
      const old = request.cookies.get(SESSION)?.value; if (old) deleteSession(old);
      const response = json({ signedOut: true }); response.cookies.set(SESSION, "", cookieOptions(request, 0)); return response;
    }
    if (action === "resources") {
      const id = campaign(input.campaignId);
      const user = await session(request, input.accountId), access = await authorizeWorkspace(id, user.account);
      if (!access.canEdit) throw new WorkspaceError(403, "Only the campaign creator can publish this brief.");
      if (typeof input.title !== "string" || !input.title.trim() || input.title.length > 120 || typeof input.body !== "string" || !input.body.trim() || input.body.length > 8000 || !Number.isSafeInteger(input.revision) || Number(input.revision) < 0) throw new WorkspaceError(400, "Enter a title (up to 120 characters) and brief (up to 8,000 characters).");
      saveBrief(id, user.account, input.title.trim(), input.body.trim(), Number(input.revision));
      return json({ ...access, brief: readBrief(id) });
    }
    return json({ error: "Not found." }, 404);
  } catch (error) { return errorResponse(error); }
}
