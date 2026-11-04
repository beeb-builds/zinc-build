"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { yoctoToNear } from "near-api-js";
import { getCampaigns } from "../../lib/zinc-contract";
import { ACTIVITY_CHANGED, getSharedActivity, publishActivityHash, readRecordedActivity, type ActivityKind, type ZincActivity } from "../../lib/zinc-activity";
import { useReadRefresh } from "../data/useReadRefresh";
import { ZINC_CONTRACT_ID } from "../../lib/near";

const filters = ["All", "Campaigns", "Deposits", "Claims", "NFT Transfers", "NFT Mints"] as const;
const labels: Record<ActivityKind, string> = { Campaigns: "Campaign created", Deposits: "Revenue deposited", Claims: "Revenue claimed", "NFT Transfers": "NFT transferred", "NFT Mints": "Revenue right minted" };

export default function ActivityFeed({ campaignId, compact = false }: { campaignId?: number; compact?: boolean }) {
  const [rows, setRows] = useState<ZincActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [storageError, setStorageError] = useState(false);
  const [filter, setFilter] = useState<(typeof filters)[number]>("All");
  const [token, setToken] = useState<string | null>(null);
  const [historyVersion, setHistoryVersion] = useState(0);
  const [hash, setHash] = useState("");
  const [signer, setSigner] = useState("");
  const [importing, setImporting] = useState(false);
  const importLock = useRef(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const { version: refresh, refresh: refreshData } = useReadRefresh();

  useEffect(() => {
    const changed = () => setHistoryVersion((value) => value + 1);
    window.addEventListener(ACTIVITY_CHANGED, changed);
    return () => window.removeEventListener(ACTIVITY_CHANGED, changed);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError(null);
      let recorded: ZincActivity[] = [];
      try { recorded = readRecordedActivity(); setStorageError(false); }
      catch { setStorageError(true); }
      const selectedToken = campaignId === undefined ? new URLSearchParams(window.location.search).get("token") : null;
      setToken(selectedToken);
      const results = await Promise.allSettled([getCampaigns(), getSharedActivity(campaignId, selectedToken, controller.signal)]);
      if (cancelled) return;
      const problems: string[] = [];
      const shared = results[1].status === "fulfilled" ? results[1].value : [];
      if (results[1].status === "rejected") problems.push("Shared receipt history is unavailable. Browser confirmations are still shown; refresh to retry.");
      const sharedHashes = new Set(shared.map((row) => row.hash));
      const known: ZincActivity[] = [...shared, ...recorded.filter((row) => !sharedHashes.has(row.hash)).map((row) => ({ ...row, source: "wallet" as const }))];
      if (results[0].status === "fulfilled") {
        const campaigns = results[0].value;
        const creations: ZincActivity[] = campaigns.map((campaign) => {
          const confirmed = known.find((row) => row.kind === "Campaigns" && row.campaignId === campaign.id);
          return { id: `campaign:${campaign.id}`, kind: "Campaigns", campaignId: campaign.id, campaignName: campaign.name,
            account: campaign.creator, timestampMs: campaign.created_at_ms, hash: confirmed?.hash, source: confirmed?.source === "rpc" ? "rpc" : "state" };
        });
        const merged = [...known.filter((row) => row.kind !== "Campaigns" || !campaigns.some((campaign) => campaign.id === row.campaignId))
          .map((row) => ({ ...row, campaignName: campaigns.find((campaign) => campaign.id === row.campaignId)?.name ?? row.campaignName })),
          ...creations];
        setRows(merged.sort((a, b) => (b.timestampMs ?? 0) - (a.timestampMs ?? 0)));
      } else {
        setRows(known.sort((a, b) => (b.timestampMs ?? 0) - (a.timestampMs ?? 0)));
        problems.push("Campaign creation records could not be loaded from NEAR.");
      }
      setError(problems.length ? problems.join(" ") : null);
      setLoading(false);
    }
    void load();
    return () => { cancelled = true; controller.abort(); };
  }, [campaignId, refresh, historyVersion]);

  async function importTransaction() {
    if (importLock.current) return;
    importLock.current = true;
    setImporting(true); setImportMessage(null);
    try {
      await publishActivityHash(hash.trim(), signer.trim());
      setImportMessage("Transaction verified on NEAR and saved to shared history.");
      setHash(""); setHistoryVersion((value) => value + 1);
    } catch (error) { setImportMessage(error instanceof Error ? error.message : "Transaction verification failed."); }
    finally { importLock.current = false; setImporting(false); }
  }

  const matching = rows.filter((row) => (campaignId === undefined || row.campaignId === campaignId) &&
    (filter === "All" || row.kind === filter) && (!token || row.tokenId === token));
  const shown = compact ? matching.slice(0, 5) : matching;
  return <section className="rounded-2xl border border-[#293954] bg-[#122344] p-6 md:p-8">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-xl font-semibold text-white">{compact ? "Recent Activity" : "Zinc activity"}</h2>
      <button type="button" onClick={refreshData} disabled={loading} className="rounded-xl border border-[#293954] px-4 py-2 text-sm text-[#A9B6CF] hover:text-white disabled:opacity-40">Refresh activity</button>
    </div>
    <p className="mt-4 text-sm leading-6 text-[#A9B6CF]">Campaign creation comes from live contract state. Shared history shows transactions independently verified through NEAR RPC, including Zinc NFT mint and transfer events.</p>
    <p className="mt-2 text-xs leading-5 text-[#71809D]">The latest 200 shared records for this selection are shown. This is not a complete historical index: only transactions submitted through this app or imported by hash are verified. Browser-only confirmations without timestamps appear last. Missing claim amounts are never inferred from balances. Payouts belong to campaign accounts, not individual NFTs.</p>
    <a href={`https://testnet.nearblocks.io/address/${ZINC_CONTRACT_ID}`} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex text-sm text-[#FF8E9C]">Explore contract activity on NEAR Blocks ↗</a>
    {!compact && <div className="mt-5 flex flex-wrap gap-2" aria-label="Activity filters">
      {filters.map((item) => <button type="button" key={item} aria-pressed={filter === item} onClick={() => setFilter(item)} className={`rounded-full border px-3 py-2 text-xs font-semibold ${filter === item ? "border-[#FF8E9C]/40 bg-[#FF8E9C]/10 text-[#FF8E9C]" : "border-[#293954] text-[#A9B6CF]"}`}>{item}</button>)}
    </div>}
    {!compact && <details className="mt-5 rounded-xl border border-[#293954] p-4">
      <summary className="cursor-pointer text-sm font-semibold text-[#A9B6CF]">Verify an earlier transaction</summary>
      <p className="mt-3 text-xs leading-5 text-[#71809D]">Paste a hash and its original signer from NEAR Blocks or wallet activity. This only reads receipts; it never signs or sends a transaction. Older transactions may be unavailable through the current RPC.</p>
      <form onSubmit={(event) => { event.preventDefault(); void importTransaction(); }} className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-[#A9B6CF]">Transaction hash<input required maxLength={44} value={hash} onChange={(event) => setHash(event.target.value)} disabled={importing} className="mt-2 w-full rounded-lg border border-[#293954] bg-[#0B1933] p-3 text-sm text-white" /></label>
        <label className="text-xs text-[#A9B6CF]">Signer account<input required maxLength={64} value={signer} onChange={(event) => setSigner(event.target.value)} disabled={importing} className="mt-2 w-full rounded-lg border border-[#293954] bg-[#0B1933] p-3 text-sm text-white" /></label>
        <button type="submit" disabled={importing || !hash.trim() || !signer.trim()} className="rounded-lg bg-[#FF8E9C] px-4 py-3 text-sm font-semibold text-[#0B1933] disabled:opacity-40">{importing ? "Verifying receipts..." : "Verify and add to history"}</button>
      </form>
      {importMessage && <p role="status" className="mt-3 text-sm text-[#A9B6CF]">{importMessage}</p>}
    </details>}
    {token && <p className="mt-4 break-all text-sm text-[#A9B6CF]">Token: {token} <button type="button" onClick={() => { window.history.replaceState(null, "", "/transactions"); setToken(null); }} className="ml-2 text-[#FF8E9C]">Show all activity</button></p>}
    {error && <p role="alert" className="mt-4 text-sm text-[#FF8E9C]">{error}</p>}
    {storageError && <p role="alert" className="mt-4 text-sm text-[#FF8E9C]">Saved wallet confirmations are unavailable in this browser. Live campaign records can still be shown.</p>}
    {loading ? <p role="status" className="mt-5 text-sm text-[#A9B6CF]">Loading Zinc activity...</p>
      : shown.length === 0 ? <p className="mt-5 text-sm text-[#A9B6CF]">No activity is available for this selection. This does not mean no transactions occurred; use the contract explorer for earlier activity.</p>
      : <div className="mt-5 space-y-3">{shown.map((row) => <article key={row.id} className="min-w-0 rounded-xl border border-[#293954] bg-[#0B1933] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3"><span className="rounded-full bg-[#FF8E9C]/10 px-3 py-1 text-xs font-semibold text-[#FF8E9C]">{labels[row.kind]}</span><span className="text-xs text-[#71809D]">{row.timestampMs !== undefined ? `${new Date(row.timestampMs).toISOString().replace("T", " ").slice(0, 19)} UTC` : "On-chain time unavailable"}</span></div>
        {row.campaignId !== undefined ? <Link href={`/campaigns/${row.campaignId}`} className="mt-3 block break-words font-semibold text-white">{row.campaignName ?? "Campaign"} · #{row.campaignId}</Link> : row.campaignName && <p className="mt-3 break-words font-semibold text-white">{row.campaignName}</p>}
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <Field label="Account" value={row.account} />
          {row.amountYocto !== undefined && <Field label="Amount" value={`${yoctoToNear(BigInt(row.amountYocto))} NEAR`} />}
          {row.tokenId && <Field label="NFT token ID" value={row.tokenId} />}
          {row.from && <Field label="From owner" value={row.from} />}{row.to && <Field label="To owner" value={row.to} />}
        </dl>
        <p className="mt-3 text-xs text-[#71809D]">{row.source === "rpc" ? "Source: finalized transaction independently verified through NEAR RPC" : row.kind === "Campaigns" ? "Source: current contract creation record" : "Source: wallet confirmation saved in this browser; not yet in shared history"}</p>
        {row.hash && <a href={`https://testnet.nearblocks.io/txns/${encodeURIComponent(row.hash)}`} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex text-sm text-[#FF8E9C]">View confirmed transaction ↗</a>}
      </article>)}</div>}
    {compact && <Link href="/transactions" className="mt-5 inline-flex text-sm text-[#FF8E9C]">View all available activity</Link>}
  </section>;
}

function Field({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><dt className="text-xs text-[#71809D]">{label}</dt><dd className="mt-1 break-all text-white">{value}</dd></div>;
}
