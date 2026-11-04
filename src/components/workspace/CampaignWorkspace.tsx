"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Buffer } from "buffer";
import { LockKeyhole, ShieldCheck } from "lucide-react";
import { useWallet } from "../wallet/WalletProvider";
import WorkspaceEligibility from "./WorkspaceEligibility";
import { invalidateReadCache } from "../../lib/read-scheduler";

type Brief = { title: string; body: string; author: string; updated: number; revision: number };
type Workspace = { campaignName: string; canEdit: boolean; accountId: string; brief: Brief | null };
type ApiResult = Workspace & { error?: string; message: string; nonce: string; recipient: string };
class WorkspaceRequestError extends Error { constructor(public status: number, message: string) { super(message); } }
const button = "rounded-xl border border-[#FF8E9C]/25 px-4 py-3 text-sm font-semibold text-[#FF8E9C] disabled:opacity-40";
const field = "mt-2 w-full rounded-xl border border-[#293954] bg-[#0B1933] px-3 py-3 text-sm text-white outline-none focus:border-[#FF8E9C]/50 disabled:opacity-50";

async function request(action: string, input: Record<string, unknown>) {
  const response = await fetch(`/api/workspace/${action}`, { method: "POST", cache: "no-store", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  const value = await response.json() as ApiResult;
  if (!response.ok) throw new WorkspaceRequestError(response.status, value.error ?? "Workspace request failed.");
  return value;
}

export default function CampaignWorkspace({ campaignId }: { campaignId: number }) {
  const { accountId, connect } = useWallet();
  return <div className="space-y-5">
    <Link href={`/campaigns/${campaignId}`} className="text-sm text-[#A9B6CF] hover:text-white">← Back to campaign #{campaignId}</Link>
    <section className="rounded-2xl border border-[#293954] bg-[#122344] p-6 md:p-8">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#FF8E9C]"><LockKeyhole size={16} /> Holder workspace</p>
      <h2 className="mt-3 text-2xl font-semibold">Campaign #{campaignId} · Private brief</h2>
      <p className="mt-3 text-sm leading-6 text-[#A9B6CF]">Current campaign NFT holders can read the creator’s private project brief. The campaign creator can publish and update it. Treasury shares and previous NFT ownership alone do not grant access.</p>
      <p className="mt-3 text-xs leading-5 text-[#71809D]">Access uses a signed message, not a transaction or spending approval. The server rechecks your key and finalized NFT ownership on every protected request. Previously copied material cannot be revoked.</p>
      {accountId ? <AccountWorkspace key={`${campaignId}:${accountId}`} campaignId={campaignId} accountId={accountId} /> : <button type="button" onClick={connect} className={`mt-5 ${button}`}>Connect wallet</button>}
    </section>
  </div>;
}

function AccountWorkspace({ campaignId, accountId }: { campaignId: number; accountId: string }) {
  const { selector } = useWallet();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);
  const [eligible, setEligible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const mounted = useRef(true), locked = useRef(false), dirty = useRef(false), authorized = useRef(false);
  const sequence = useRef(0);

  function clear() { authorized.current = false; dirty.current = false; setEligible(false); setWorkspace(null); setTitle(""); setText(""); }
  function apply(value: Workspace) {
    authorized.current = true; setWorkspace(value);
    if (!dirty.current) { setTitle(value.brief?.title ?? ""); setText(value.brief?.body ?? ""); }
  }
  async function load(signal?: AbortSignal) {
    const version = ++sequence.current;
    try {
      const response = await fetch(`/api/workspace/resources?campaign_id=${campaignId}&account_id=${encodeURIComponent(accountId)}`, { cache: "no-store", credentials: "same-origin", signal });
      const value = await response.json() as ApiResult;
      if (!mounted.current || version !== sequence.current) return;
      if (response.ok) { apply(value); setError(null); }
      else { clear(); setError(response.status === 401 ? null : value.error ?? "Workspace access is unavailable."); if (response.status === 403) invalidateReadCache(); }
    } catch {
      if (mounted.current && !signal?.aborted && version === sequence.current) { clear(); setError("Could not recheck access. Protected content was cleared; retry when the connection is available."); }
    } finally { if (mounted.current && version === sequence.current) setChecking(false); }
  }
  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- The protected external session must be revalidated on mount; load clears private content on denial.
    void load(controller.signal);
    const recheck = () => { if (!locked.current && authorized.current && document.visibilityState === "visible") void load(controller.signal); };
    const timer = window.setInterval(recheck, 30_000);
    window.addEventListener("focus", recheck);
    return () => { mounted.current = false; controller.abort(); window.clearInterval(timer); window.removeEventListener("focus", recheck); };
    // Account/campaign changes remount this component and clear all protected state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId, accountId]);

  async function authenticate() {
    if (!selector || locked.current || !eligible) return;
    locked.current = true; setBusy(true); setError(null); setNotice(null);
    try {
      const challenge = await request("challenge", { accountId });
      const wallet = await selector.wallet();
      const signed = await wallet.signMessage({ message: challenge.message, recipient: challenge.recipient, nonce: Buffer.from(challenge.nonce, "base64") });
      if (!signed) throw new Error("This wallet did not return a signed message. Use a wallet supporting a direct NEP-413 message response, then try again.");
      if (!mounted.current || signed.accountId !== accountId || selector.store.getState().accounts.find((account) => account.active)?.accountId !== accountId) throw new Error("The connected wallet changed. Reopen the workspace with the intended account.");
      await request("auth", { accountId, publicKey: signed.publicKey, signature: signed.signature });
      if (mounted.current) await load();
    } catch (failure) {
      if (mounted.current) { clear(); setError(failure instanceof Error ? failure.message : "Wallet message signing was cancelled or failed."); }
    } finally { locked.current = false; if (mounted.current) setBusy(false); }
  }
  async function save() {
    if (locked.current || !workspace?.canEdit) return;
    locked.current = true; setBusy(true); setError(null); setNotice(null); sequence.current++;
    try {
      const value = await request("resources", { campaignId: String(campaignId), accountId, title, body: text, revision: workspace.brief?.revision ?? 0 });
      if (mounted.current) { dirty.current = false; apply(value); setNotice("Private brief published to the current-holder workspace."); }
    } catch (failure) {
      if (mounted.current) {
        if (failure instanceof WorkspaceRequestError && failure.status === 409) {
          await load();
          if (mounted.current) setError(authorized.current
            ? "A newer brief was published. Your draft is preserved; review the latest published version before saving again."
            : "Access could not be reverified while resolving the edit conflict. The protected draft was cleared; sign in again.");
        } else { clear(); setError(failure instanceof Error ? failure.message : "The brief could not be saved. Recheck access and retry."); }
      }
    } finally { locked.current = false; if (mounted.current) setBusy(false); }
  }
  async function close() {
    if (locked.current) return;
    locked.current = true; setBusy(true); sequence.current++;
    try { await request("logout", {}); if (mounted.current) { clear(); setNotice("Workspace session closed."); } }
    catch { if (mounted.current) { clear(); setError("Could not close the server session. Retry closing it; the session expires after 15 minutes."); } }
    finally { locked.current = false; if (mounted.current) setBusy(false); }
  }
  return <div className="mt-6 space-y-5">
    <p className="break-all text-xs text-[#A9B6CF]">Connected account: {accountId}</p>
    {checking ? <p role="status" className="text-sm text-[#A9B6CF]">Checking your workspace session...</p> : !workspace ? <>
      <WorkspaceEligibility campaignId={campaignId} accountId={accountId} busy={busy} onEligibility={setEligible} />
      <div className="flex flex-wrap gap-3"><button type="button" onClick={authenticate} disabled={busy || !selector || !eligible} className={button}>{busy ? "Verify the message in your wallet..." : "Sign message & open workspace"}</button><button type="button" onClick={() => { if (locked.current) return; locked.current = true; setEligible(false); setChecking(true); void load().finally(() => { locked.current = false; }); }} disabled={busy} className={button}>Recheck existing session</button></div>
      <p className="text-xs leading-5 text-[#71809D]">Rechecking an existing session does not request a new signature. Every protected request still rechecks current access. The preview above contains no private brief content.</p>
    </> : <>
      <div className="flex flex-wrap items-center justify-between gap-3"><p className="flex min-w-0 items-center gap-2 break-words text-sm text-[#69dab8]"><ShieldCheck size={18} className="shrink-0" />{workspace.campaignName} · {workspace.canEdit ? "Creator access" : "Current-holder access"}</p><div className="flex flex-wrap gap-3"><button type="button" onClick={() => void load()} disabled={busy} className={button}>Recheck access</button><button type="button" onClick={close} disabled={busy} className={button}>Close workspace</button></div></div>
      {workspace.brief ? <article className="rounded-xl border border-[#293954] bg-[#0B1933] p-5"><h3 className="break-words text-xl font-semibold">{workspace.brief.title}</h3><p className="mt-4 whitespace-pre-wrap break-words text-sm leading-7 text-[#A9B6CF]">{workspace.brief.body}</p><p className="mt-4 break-all text-xs text-[#71809D]">Published by {workspace.brief.author} · {new Date(workspace.brief.updated).toLocaleString()} · Revision {workspace.brief.revision}</p></article> : <p className="rounded-xl border border-[#293954] bg-[#0B1933] p-5 text-sm text-[#A9B6CF]">The campaign creator has not published a private brief yet.</p>}
      {workspace.canEdit && <form onSubmit={(event) => { event.preventDefault(); void save(); }} className="space-y-4 border-t border-[#293954] pt-5">
        <h3 className="font-semibold">Publish a campaign brief</h3>
        <p className="text-xs leading-5 text-[#71809D]">Share project updates, collaboration instructions, or links intended for current holders. Do not publish passwords, private keys, or secrets. Text is stored by this Zinc app, not on-chain.</p>
        <label className="block text-sm text-[#A9B6CF]">Title<input required maxLength={120} value={title} onChange={(event) => { dirty.current = true; setTitle(event.target.value); }} disabled={busy} className={field} /></label>
        <label className="block text-sm text-[#A9B6CF]">Private brief<textarea required maxLength={8000} rows={8} value={text} onChange={(event) => { dirty.current = true; setText(event.target.value); }} disabled={busy} className={field} /></label>
        <button type="submit" disabled={busy || !title.trim() || !text.trim()} className={button}>{busy ? "Saving..." : "Publish private brief"}</button>
      </form>}
    </>}
    {error && <p role="alert" className="break-words text-sm text-[#FF8E9C]">{error}</p>}
    {notice && <p role="status" className="text-sm text-[#69dab8]">{notice}</p>}
  </div>;
}
