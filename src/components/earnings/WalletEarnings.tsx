"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Wallet } from "lucide-react";
import { yoctoToNear } from "near-api-js";
import { useWallet } from "../wallet/WalletProvider";
import { useReadRefresh } from "../data/useReadRefresh";
import { getCampaigns } from "../../lib/zinc-contract";
import { getSharedActivity } from "../../lib/zinc-activity";
import { previouslyHeldRightIds } from "../../lib/right-history";
import { filterEarningsRows, readEarningsBalances, readEarningsOwnership, relatedEarningsRows, validateEarningsCampaigns, type EarningsBalance, type EarningsFilter, type EarningsOwnership, type EarningsRow } from "../../lib/wallet-earnings";
import { rightHref } from "../nfts/RevenueRightCard";

const button = "rounded-xl border border-[#FF8E9C]/25 px-4 py-2 text-sm font-semibold text-[#FF8E9C] transition hover:bg-[#FF8E9C]/10 disabled:opacity-40";
const filters: EarningsFilter[] = ["All", "Claimable", "Current rights", "Previously held", "Treasury"];
function near(amount: bigint) { return `${yoctoToNear(amount)} NEAR`; }

export default function WalletEarnings() {
  const { accountId, connect, isInitializing } = useWallet();
  if (!accountId && isInitializing) return <section role="status" className="rounded-2xl border border-[#293954] bg-[#122344] p-8"><h2 className="text-xl font-semibold text-white">Restoring your wallet</h2><p className="mt-3 text-sm leading-6 text-[#A9B6CF]">Checking for a saved NEAR Testnet session before reading your earnings. Balances will load once the account is known.</p></section>;
  if (!accountId) return <section className="rounded-2xl border border-[#293954] bg-[#122344] p-8"><Wallet size={28} className="text-[#FF8E9C]" /><h2 className="mt-4 text-xl font-semibold text-white">Connect your wallet</h2><p className="mt-3 text-sm leading-6 text-[#A9B6CF]">Connect a NEAR Testnet wallet to see claimable revenue, past claims, and current revenue rights across Zinc campaigns.</p><button type="button" onClick={connect} className={`mt-5 ${button}`}>Connect Wallet</button></section>;
  return <AccountEarnings key={accountId} accountId={accountId} />;
}

function AccountEarnings({ accountId }: { accountId: string }) {
  const [balances, setBalances] = useState<EarningsBalance[] | null>(null);
  const [ownership, setOwnership] = useState<EarningsOwnership | null>(null);
  const [history, setHistory] = useState<Set<string> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState(false);
  const [filter, setFilter] = useState<EarningsFilter>("All");
  const { version, refresh } = useReadRefresh();
  useEffect(() => {
    let cancelled = false; const controller = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- A cache refresh invalidates the complete balance/ownership snapshot before independent reads begin.
    setBalances(null); setOwnership(null); setHistory(null); setError(null); setHistoryError(false);
    void getCampaigns().then((campaigns) => {
      validateEarningsCampaigns(campaigns);
      if (cancelled) return;
      void readEarningsBalances(campaigns, accountId).then((result) => { if (!cancelled) setBalances(result); })
        .catch((failure) => { if (!cancelled) setError(failure instanceof Error ? failure.message : "NEAR balances are unavailable."); });
      void readEarningsOwnership(campaigns, accountId).then((result) => { if (!cancelled) setOwnership(result); })
        .catch(() => { if (!cancelled) setOwnership({ rights: new Map(), ownedCount: null, warnings: ["Ownership could not be loaded. Complete balance totals are still shown independently."] }); });
      void getSharedActivity(undefined, undefined, controller.signal, accountId).then((rows) => { if (!cancelled) setHistory(previouslyHeldRightIds(rows, accountId)); })
        .catch(() => { if (!cancelled) { setHistory(new Set()); setHistoryError(true); } });
    }).catch((failure) => { if (!cancelled) setError(failure instanceof Error ? failure.message : "Campaigns could not be loaded."); });
    return () => { cancelled = true; controller.abort(); };
  }, [accountId, version]);
  const rows = balances ? relatedEarningsRows(balances, ownership, history ?? new Set(), accountId) : [];
  const loading = !balances && !error;
  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[#293954] bg-[#0B1933] p-4"><p className="min-w-0 break-all text-sm text-[#A9B6CF]">Earnings for <span className="font-medium text-white">{accountId}</span></p><button type="button" onClick={refresh} disabled={loading} className={button}>Refresh earnings</button></div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Summary label="Total Claimable" value={balances ? near(balances.reduce((sum, row) => sum + row.claimable, BigInt(0))) : loading ? "Loading..." : "Unavailable"} />
      <Summary label="Total Claimed" value={balances ? near(balances.reduce((sum, row) => sum + row.claimed, BigInt(0))) : loading ? "Loading..." : "Unavailable"} />
      <Summary label="Current Rights Owned" value={ownership?.ownedCount !== null && ownership?.ownedCount !== undefined ? String(ownership.ownedCount) : ownership || error ? "Unavailable" : "Loading..."} />
      <Summary label="Campaigns With Earnings" value={balances ? String(balances.filter((row) => row.claimable > BigInt(0) || row.claimed > BigInt(0)).length) : loading ? "Loading..." : "Unavailable"} />
    </div>
    <section className="rounded-2xl border border-[#293954] bg-[#122344] p-6 md:p-8">
      <h2 className="text-xl font-semibold text-white">Campaign earnings</h2>
      <p className="mt-3 text-sm leading-6 text-[#A9B6CF]">Previously earned revenue remains claimable after an NFT leaves your wallet. Future revenue follows current NFT ownership; treasury revenue stays account-based.</p>
      <p className="mt-2 text-xs leading-5 text-[#71809D]">Balances are complete account totals across all campaigns, never per-NFT payout estimates. Campaigns With Earnings counts positive claimable or claimed balances. Claimed totals may include payouts awaiting their callback. Ownership and history load separately; they cannot hide complete revenue totals.</p>
      {ownership?.warnings.map((warning) => <p key={warning} role="status" className="mt-3 text-sm text-[#FF8E9C]">{warning} Use Refresh earnings to retry.</p>)}
      {historyError && <p role="status" className="mt-3 text-sm text-[#FF8E9C]">Shared ownership history is unavailable. Recorded balances, original allocations and current rights remain visible. Some former-owner campaigns with zero earnings may be missing.</p>}
      <p className="mt-3 text-xs leading-5 text-[#71809D]">Related campaigns can also have zero earnings when you hold a right, have an original allocation, are treasury, or appear in verified ownership history. Shared history covers at most 200 recorded ownership events for this account and may have gaps.</p>
      <div className="mt-5 flex flex-wrap gap-2" aria-label="Earnings filters">{filters.map((item) => <button key={item} type="button" aria-pressed={filter === item} onClick={() => setFilter(item)} className={`rounded-full border px-3 py-2 text-xs font-semibold ${filter === item ? "border-[#FF8E9C]/40 bg-[#FF8E9C]/10 text-[#FF8E9C]" : "border-[#293954] text-[#A9B6CF]"}`}>{item}</button>)}</div>
      {loading ? <p role="status" className="mt-5 text-sm text-[#A9B6CF]">Reading revenue balances across all campaigns...</p>
        : error ? <p role="alert" className="mt-5 text-sm text-[#FF8E9C]">Revenue totals could not be loaded: {error} No partial balance totals are shown. Refresh earnings to retry.</p>
        : <EarningsResults rows={filterEarningsRows(rows, filter)} relatedCount={rows.length} filter={filter} enrichmentLoading={!ownership || !history} />}
    </section>
  </div>;
}

export function EarningsResults({ rows, relatedCount, filter, enrichmentLoading }: { rows: EarningsRow[]; relatedCount: number; filter: EarningsFilter; enrichmentLoading: boolean }) {
  return <>
    <p className="mt-4 text-xs text-[#71809D]">{relatedCount} related {relatedCount === 1 ? "campaign" : "campaigns"} found · claimable balances first</p>
    {enrichmentLoading && <p role="status" className="mt-3 text-sm text-[#A9B6CF]">Ownership and previous-right history are still loading. More related campaigns may appear; available balance totals are already complete.</p>}
    {rows.length === 0 ? <p className="mt-5 rounded-xl border border-[#293954] bg-[#0B1933] p-5 text-sm text-[#A9B6CF]">{enrichmentLoading ? "No campaigns match this filter in the data loaded so far." : filter === "All" ? "No related campaigns or recorded earnings were found in the available data." : "No campaigns match this earnings filter."}</p>
      : <div className="mt-5 space-y-4">{rows.map((row) => <article key={row.campaign.id} className="rounded-xl border border-[#293954] bg-[#0B1933] p-5">
        <Link href={`/campaigns/${row.campaign.id}`} className="break-words text-lg font-semibold text-white hover:text-[#FF8E9C]">{row.campaign.name} · #{row.campaign.id}</Link>
        <div className="mt-3 flex flex-wrap gap-2"><Badge text={row.currentRights === null ? "Current ownership unavailable / loading" : row.currentRights.length ? `Current NFT owner · ${row.currentRights.length} right${row.currentRights.length === 1 ? "" : "s"}` : "No current NFT rights"} />{row.previousRights && <Badge text="Previously held rights" />}{row.retainedRevenue && <Badge text="Retained historical earnings" />}{row.treasury && <Badge text={`Treasury · ${row.campaign.treasury_share_bps / 100}% account-based`} />}</div>
        <dl className="mt-5 grid gap-4 sm:grid-cols-2"><Amount label="Claimable" value={near(row.claimable)} /><Amount label="Claimed" value={near(row.claimed)} /></dl>
        {(row.currentRights?.length ?? 0) > 0 && <div className="mt-4 text-sm text-[#A9B6CF]"><p className="font-medium text-white">Current NFT roles / shares</p>{row.currentRights!.map((right) => <Link key={right.token_id} href={rightHref(right.token_id)} className="mt-2 block break-all text-[#FF8E9C]">{right.role} · {right.share_bps / 100}% · {right.token_id} ↗</Link>)}</div>}
        {row.originalShares.length > 0 && <p className="mt-4 break-words text-xs leading-5 text-[#71809D]">Original allocation (not proof of current ownership): {row.originalShares.map((share) => `${share.role} · ${share.share_bps / 100}%`).join(", ")}</p>}
        <p className="mt-3 text-xs leading-5 text-[#71809D]">This campaign balance can include multiple rights, retained historical earnings and treasury shares. These amounts cannot be split into per-NFT earnings using the current contract views.</p>
        <Link href={`/campaigns/${row.campaign.id}#claim-revenue`} className={`mt-4 inline-flex rounded-lg px-4 py-2 text-sm font-semibold ${row.claimable > BigInt(0) ? "bg-[#FF8E9C] text-[#0B1933]" : "border border-[#293954] text-[#A9B6CF]"}`}>{row.claimable > BigInt(0) ? "Claim available revenue ↗" : "View campaign balances ↗"}</Link>
      </article>)}</div>}
  </>;
}
function Summary({ label, value }: { label: string; value: string }) { return <div className="min-w-0 rounded-2xl border border-[#293954] bg-[#122344] p-5"><p className="text-xs text-[#A9B6CF]">{label}</p><p className="mt-3 break-all text-2xl font-semibold text-[#FF8E9C]">{value}</p></div>; }
function Amount({ label, value }: { label: string; value: string }) { return <div className="min-w-0"><dt className="text-xs text-[#71809D]">{label}</dt><dd className="mt-1 break-all font-semibold text-white">{value}</dd></div>; }
function Badge({ text }: { text: string }) { return <span className="rounded-full border border-[#FF8E9C]/25 bg-[#FF8E9C]/10 px-3 py-1 text-xs text-[#FF8E9C]">{text}</span>; }
