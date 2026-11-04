"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { yoctoToNear } from "near-api-js";
import { useWallet } from "../wallet/WalletProvider";
import { useReadRefresh } from "../data/useReadRefresh";
import { getCampaigns, type OnChainCampaign } from "../../lib/zinc-contract";
import { campaignDiscoveryTotals, campaignStatus, discoverCampaigns, validateDiscoveryCampaigns, type CampaignRelationship, type CampaignSort, type CampaignStatus } from "../../lib/campaign-discovery";

const input = "rounded-xl border border-[#293954] bg-[#0B1933] px-3 py-3 text-sm text-white outline-none focus:border-[#FF8E9C]/40";
const statuses: ("All" | CampaignStatus)[] = ["All", "Active", "Scheduled", "Ended"];
function date(timestamp: number) { return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(timestamp); }

export default function CampaignExplorer({ initialCampaigns, initialTime }: { initialCampaigns: OnChainCampaign[] | null; initialTime: number }) {
  const { accountId } = useWallet();
  const [campaigns, setCampaigns] = useState(initialCampaigns);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(initialCampaigns === null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"All" | CampaignStatus>("All");
  const [sort, setSort] = useState<CampaignSort>("Newest");
  const [relationship, setRelationship] = useState<CampaignRelationship>("All");
  const [now, setNow] = useState(initialTime);
  const [requestedRefresh, setRequestedRefresh] = useState(false);
  const { version, refresh } = useReadRefresh();
  // eslint-disable-next-line react-hooks/set-state-in-effect -- A wallet identity change must clear the previous account's relationship filter.
  useEffect(() => { setRelationship("All"); }, [accountId]);
  useEffect(() => {
    const update = () => setNow(Date.now());
    update(); window.addEventListener("focus", update);
    return () => window.removeEventListener("focus", update);
  }, []);
  useEffect(() => {
    // Only rerender when an actual campaign status boundary is reached.
    const current = Date.now();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Resynchronize an external clock after a throttled timer or a changed RPC snapshot.
    if (campaigns?.some((campaign) => campaignStatus(campaign, now) !== campaignStatus(campaign, current))) { setNow(current); return; }
    const next = (campaigns ?? []).flatMap((campaign) => [campaign.start_timestamp_ms, campaign.end_timestamp_ms + 1]).filter((time) => time > current).sort((a, b) => a - b)[0];
    const timer = next !== undefined ? window.setTimeout(() => setNow(Date.now()), Math.min(next - current + 1, 2147483647)) : undefined;
    return () => { if (timer !== undefined) window.clearTimeout(timer); };
  }, [campaigns, now]);
  useEffect(() => {
    // The server supplies the initial snapshot; navigation does not need a duplicate RPC.
    if (version === 0 && !requestedRefresh) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Announce the explicit external-cache refresh while its cancellable RPC read is pending.
    setLoading(true); setError(false);
    void getCampaigns().then((result) => {
      validateDiscoveryCampaigns(result);
      if (!cancelled) { setCampaigns(result); setNow(Date.now()); }
    }).catch(() => { if (!cancelled) setError(true); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [version, requestedRefresh]);
  const totals = useMemo(() => campaigns ? campaignDiscoveryTotals(campaigns, now) : null, [campaigns, now]);
  const selected = useMemo(() => discoverCampaigns(campaigns ?? [], { query, status, sort, relationship, accountId, now }), [campaigns, query, status, sort, relationship, accountId, now]);
  function reset() { setQuery(""); setStatus("All"); setSort("Newest"); setRelationship("All"); }
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[#293954] bg-[#0B1933] p-4"><p className="text-sm text-[#A9B6CF]">Network · <span className="font-medium text-white">NEAR Testnet</span></p><button type="button" onClick={() => { setRequestedRefresh(true); refresh(); }} disabled={loading} className="rounded-xl border border-[#293954] px-4 py-2 text-sm text-[#A9B6CF] hover:text-white disabled:opacity-40">{loading ? "Refreshing..." : "Refresh campaigns"}</button></div>
    <div className="grid gap-4 sm:grid-cols-3"><Summary label="On-chain campaigns" value={totals ? String(totals.count) : "Unavailable"} /><Summary label="Active campaigns" value={totals ? String(totals.active) : "Unavailable"} /><Summary label="Total deposited · all campaigns" value={totals ? `${yoctoToNear(totals.revenueYocto)} NEAR` : "Unavailable"} /></div>
    <section aria-label="Find campaigns" className="rounded-2xl border border-[#293954] bg-[#122344] p-5">
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto_auto]"><label className="min-w-0 text-xs text-[#A9B6CF]">Search campaigns<input value={query} maxLength={200} onChange={(event) => setQuery(event.target.value)} placeholder="Name, #ID, creator or original contributor" className={`mt-2 w-full ${input}`} /></label>
        <label className="text-xs text-[#A9B6CF]">Sort by<select value={sort} onChange={(event) => setSort(event.target.value as CampaignSort)} className={`mt-2 block w-full ${input}`}>{["Newest", "Revenue", "Ending soon"].map((value) => <option key={value}>{value}</option>)}</select></label>
        <label className="text-xs text-[#A9B6CF]">Your relationship<select value={relationship} onChange={(event) => setRelationship(event.target.value as CampaignRelationship)} className={`mt-2 block w-full ${input}`}><option>All</option><option disabled={!accountId}>Created by me</option><option disabled={!accountId}>Original contributor</option></select></label></div>
      <div className="mt-4 flex flex-wrap gap-2" aria-label="Campaign status">{statuses.map((value) => <button key={value} type="button" aria-pressed={status === value} onClick={() => setStatus(value)} className={`rounded-full border px-3 py-2 text-xs font-semibold ${status === value ? "border-[#FF8E9C]/40 bg-[#FF8E9C]/10 text-[#FF8E9C]" : "border-[#293954] text-[#A9B6CF]"}`}>{value}</button>)}</div>
      <p className="mt-3 text-xs leading-5 text-[#71809D]">{accountId ? "Original contributor means an allocation at creation, not proof of current NFT ownership." : "Connect your wallet to filter campaigns you created or originally contributed to."} Search and filters run locally without extra RPC requests.</p>
    </section>
    {error && <p role="alert" className="rounded-xl border border-[#FF8E9C]/20 p-5 text-sm text-[#FF8E9C]">{campaigns ? "The refresh failed. The previous snapshot remains visible; totals are not a new RPC result." : "Campaigns could not be loaded from NEAR. Counts and revenue are unavailable, not zero."} Use Refresh campaigns to retry.</p>}
    {campaigns && <><p role="status" className="text-xs text-[#71809D]">Showing {selected.length} of {campaigns.length} campaigns{loading ? " · refreshing snapshot" : ""}. Summary totals cover all campaigns.</p>
      {campaigns.length === 0 ? <div className="rounded-2xl border border-[#293954] bg-[#122344] p-8 text-center"><h2 className="text-lg font-semibold">No campaigns yet</h2><p className="mt-2 text-sm text-[#A9B6CF]">Create the first programmable revenue-rights campaign.</p></div>
        : selected.length === 0 ? <div className="rounded-2xl border border-[#293954] bg-[#122344] p-8"><h2 className="text-lg font-semibold">No matching campaigns</h2><p className="mt-2 text-sm text-[#A9B6CF]">Try another search, status or relationship.</p><button type="button" onClick={reset} className="mt-4 text-sm text-[#FF8E9C]">Clear filters</button></div>
        : <div className="grid items-start gap-5 lg:grid-cols-2 xl:grid-cols-3">{selected.map((campaign) => <CampaignDiscoveryCard key={campaign.id} campaign={campaign} now={now} />)}</div>}</>}
  </div>;
}

export function CampaignDiscoveryCard({ campaign, now }: { campaign: OnChainCampaign; now: number }) {
  const status = campaignStatus(campaign, now);
  return <article className="min-w-0 rounded-2xl border border-[#293954] bg-[#122344] p-5">
    <div className="mb-5 flex items-start justify-between gap-4"><div className="min-w-0"><p className="text-xs font-medium uppercase tracking-[0.16em] text-[#71809D]">Campaign #{campaign.id}</p><h2 className="mt-2 break-words text-xl font-semibold text-white">{campaign.name}</h2></div><span className="shrink-0 rounded-full border border-[#FF8E9C]/25 bg-[#FF8E9C]/10 px-3 py-1 text-xs font-semibold text-[#FF8E9C]">{status}</span></div>
    <p className="line-clamp-3 min-h-12 break-words text-sm leading-6 text-[#A9B6CF]">{campaign.description}</p>
    <p className="mt-3 break-all text-xs text-[#71809D]">Created by {campaign.creator}</p>
    <dl className="my-5 grid gap-4 border-y border-[#293954] py-5 sm:grid-cols-2"><Metric label="Revenue deposited" value={`${yoctoToNear(BigInt(campaign.total_deposited_yocto))} NEAR`} /><Metric label="Contributor allocations" value={String(campaign.contributors.length)} /><Metric label="Starts (UTC)" value={date(campaign.start_timestamp_ms)} /><Metric label="Ends (UTC)" value={date(campaign.end_timestamp_ms)} /></dl>
    <p className="mb-3 text-xs text-[#71809D]">Contributor NFT shares</p><div className="space-y-2">{campaign.contributors.map((contributor, index) => <div key={index} className="flex items-start justify-between gap-3 text-sm"><span className="break-words text-[#A9B6CF]">{contributor.role}</span><span className="shrink-0 font-medium text-white">{contributor.share_bps / 100}%</span></div>)}<div className="flex justify-between gap-3 text-sm"><span className="text-[#A9B6CF]">Treasury · account-based</span><span className="font-medium text-white">{campaign.treasury_share_bps / 100}%</span></div></div>
    <Link href={`/campaigns/${campaign.id}`} className="mt-5 flex items-center justify-between gap-3 rounded-xl border border-[#293954] px-4 py-3 text-sm font-medium text-white hover:bg-white/5">View campaign &amp; current rights<ArrowRight size={16} /></Link>
    <Link href={`/campaigns/${campaign.id}#project-team`} className="mt-3 mr-4 inline-flex text-sm font-semibold text-[#FF8E9C]">Meet the team &amp; inspect NFTs ↗</Link>
    {status === "Active" && <Link href={`/pay/${campaign.id}`} className="mt-3 inline-flex text-sm text-[#FF8E9C]">Support this campaign ↗</Link>}
  </article>;
}
function Summary({ label, value }: { label: string; value: string }) { return <div className="min-w-0 rounded-xl border border-[#293954] bg-[#0B1933] p-4"><p className="text-xs text-[#71809D]">{label}</p><p className="mt-2 break-all text-lg font-semibold text-[#FF8E9C]">{value}</p></div>; }
function Metric({ label, value }: { label: string; value: string }) { return <div className="min-w-0"><dt className="text-xs text-[#71809D]">{label}</dt><dd className="mt-1 break-all text-sm font-medium text-white">{value}</dd></div>; }
