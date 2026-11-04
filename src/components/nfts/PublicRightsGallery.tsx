"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useWallet } from "../wallet/WalletProvider";
import { useReadRefresh } from "../data/useReadRefresh";
import { filterPublicRights, readPublicRights } from "../../lib/public-rights";
import RevenueRightCard from "./RevenueRightCard";

type Snapshot = Awaited<ReturnType<typeof readPublicRights>>;
export default function PublicRightsGallery() {
  const { accountId } = useWallet();
  const { version, refresh } = useReadRefresh();
  const [snapshot, setSnapshot] = useState<{ version: number; data: Snapshot | null; error: boolean } | null>(null);
  const [query, setQuery] = useState("");
  const [campaignId, setCampaignId] = useState("all");
  useEffect(() => {
    let cancelled = false;
    void readPublicRights().then((data) => { if (!cancelled) setSnapshot({ version, data, error: false }); })
      .catch(() => { if (!cancelled) setSnapshot({ version, data: null, error: true }); });
    return () => { cancelled = true; };
  }, [version]);
  const current = snapshot?.version === version ? snapshot : null;
  const data = current?.data;
  const choices = useMemo(() => [...new Map(data?.rights.map(({ campaign }) => [campaign.id, campaign])).values()], [data]);
  const shown = data ? filterPublicRights(data.rights, query, campaignId) : [];
  return <>
    <section className="rounded-[28px] border border-[#ff9988]/20 bg-gradient-to-br from-[#142947] to-[#10213d] p-5 sm:p-7">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#ff9988]">Real NFTs. Programmable revenue rights.</p><h2 className="mt-3 text-3xl font-semibold">The rights behind the projects</h2>
      <p className="mt-4 max-w-3xl text-sm leading-6 text-[#aebbd0]">Browse minted Zinc NEP-171 NFTs without connecting a wallet. Each contributor right controls a programmed share of future campaign revenue. These cards show live token identities and current owners.</p>
      <p className="mt-3 text-xs leading-5 text-[#8fa0bc]">Future revenue follows the current NFT owner. Previously earned revenue remains with the former owner. This gallery is for inspection; it is not a marketplace or an offer to buy rights.</p>
      <div className="mt-5 flex flex-wrap gap-3"><Link href="/nfts" className="rounded-xl bg-[#ff9988] px-4 py-3 text-sm font-semibold text-[#07142d]">View my owned NFTs</Link><Link href="/campaigns/new" className="rounded-xl border border-white/15 px-4 py-3 text-sm text-[#aebbd0]">Create a project &amp; mint contributor rights</Link></div>
    </section>
    <section aria-label="Filter public NFTs" className="mt-5 rounded-2xl border border-white/[0.07] bg-[#10213d] p-5">
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"><label className="text-xs text-[#aebbd0]">Search rights<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Project, role, token or account" className="mt-2 block w-full min-w-0 rounded-xl border border-white/10 bg-[#0b1b34] px-3 py-3 text-sm text-white outline-none focus:border-[#ff9988]" /></label><label className="text-xs text-[#aebbd0]">Project<select value={campaignId} onChange={(event) => setCampaignId(event.target.value)} className="mt-2 block w-full min-w-0 rounded-xl border border-white/10 bg-[#0b1b34] px-3 py-3 text-sm text-white"><option value="all">All projects</option>{choices.map((campaign) => <option key={campaign.id} value={String(campaign.id)}>{campaign.name} · #{campaign.id}</option>)}</select></label><button type="button" onClick={refresh} disabled={!current} className="self-end rounded-xl border border-[#ff9988]/25 px-4 py-3 text-sm text-[#ff9988] disabled:opacity-40">Refresh NFTs</button></div>
    </section>
    {!current && <p role="status" className="mt-5 text-sm text-[#aebbd0]">Loading public revenue-right NFTs from NEAR Testnet…</p>}
    {current?.error && <p role="alert" className="mt-5 rounded-xl border border-[#ff9988]/25 p-5 text-sm text-[#ff9988]">Public NFTs could not be loaded. This does not mean no NFTs exist. Select Refresh NFTs to retry.</p>}
    {data && <>
      {data.unavailable.length > 0 && <p role="alert" className="mt-5 rounded-xl border border-[#ff9988]/25 p-4 text-sm text-[#ff9988]">Rights for {data.unavailable.length} project{data.unavailable.length === 1 ? "" : "s"} could not be loaded (#{data.unavailable.join(", #")}). This gallery is incomplete. Refresh to retry.</p>}
      <p role="status" className="mt-5 text-sm text-[#8fa0bc]">Showing {shown.length} of {data.rights.length} loaded NFTs{data.unavailable.length ? " · partial snapshot" : ` across ${data.campaignCount} projects`}. These are public rights, not your wallet balance.</p>
      <div className="mt-5 grid items-start gap-5 md:grid-cols-2 xl:grid-cols-3">{shown.map(({ campaign, right, originalContributor }) => <article key={right.token_id} className="min-w-0 rounded-[24px] border border-white/[0.07] bg-[#10213d] p-3 sm:p-4">
        <RevenueRightCard right={right} campaignName={campaign.name} status={accountId === right.owner_id ? "Owned by you" : right.owner_id === originalContributor ? "Original owner" : "Transferred"} />
        <div className="mt-4 px-1"><p className="text-xs text-[#8fa0bc]">Original contributor</p><p className="mt-1 break-all text-xs leading-5 text-[#aebbd0]">{originalContributor}</p><Link href={`/campaigns/${campaign.id}#project-team`} className="mt-3 inline-flex text-sm font-semibold text-[#ff9988]">Meet the project team ↗</Link></div>
      </article>)}</div>
      {shown.length === 0 && <div className="mt-5 rounded-2xl border border-white/[0.07] bg-[#10213d] p-6 text-sm leading-6 text-[#aebbd0]">{data.unavailable.length && data.rights.length === 0 ? "No complete NFT records could be loaded. Retry the unavailable projects before treating this as an empty gallery." : data.rights.length === 0 ? "No contributor NFT rights have been found in the loaded projects yet. Create a project to mint its first rights." : "No rights match these filters."}{data.rights.length > 0 && <button type="button" onClick={() => { setQuery(""); setCampaignId("all"); }} className="ml-2 text-[#ff9988] underline">Clear filters</button>}</div>}
    </>}
  </>;
}
