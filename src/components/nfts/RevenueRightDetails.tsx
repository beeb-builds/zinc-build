"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Copy, ShieldCheck } from "lucide-react";
import { yoctoToNear } from "near-api-js";
import RevenueRightCard from "./RevenueRightCard";
import RightOwnershipHistory from "./RightOwnershipHistory";
import ClaimRevenueSection from "../campaigns/ClaimRevenueSection";
import { useWallet } from "../wallet/WalletProvider";
import { useReadRefresh } from "../data/useReadRefresh";
import { getCampaign, getNftToken, getRevenueRight, type OnChainCampaign, type OnChainRevenueRight } from "../../lib/zinc-contract";
import { ZINC_CONTRACT_ID } from "../../lib/near";

type RightData = { right: OnChainRevenueRight; campaign: OnChainCampaign };
const panel = "rounded-2xl border border-[#293954] bg-[#122344] p-6 md:p-8";

export default function RevenueRightDetails({ tokenId }: { tokenId: string }) {
  const { accountId } = useWallet();
  const [data, setData] = useState<RightData | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const { version: refresh, refresh: refreshData } = useReadRefresh();

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Invalidate the old token/RPC snapshot so it cannot stand in for the newly requested right.
    setState("loading");
    setData(null);
    async function load() {
      if (!/^campaign:\d+:right:\d+$/.test(tokenId)) { if (!cancelled) setState("missing"); return; }
      try {
        const [token, right] = await Promise.all([getNftToken(tokenId), getRevenueRight(tokenId)]);
        if (!token || !right) { if (!cancelled) setState("missing"); return; }
        const campaign = await getCampaign(right.campaign_id);
        if (!campaign) throw new Error("Campaign unavailable.");
        if (token.owner_id !== right.owner_id || right.token_id !== tokenId || token.token_id !== tokenId || !campaign.contributors[right.contributor_index]) throw new Error("Ownership changed while loading.");
        if (typeof campaign.total_deposited_yocto !== "string" || !/^\d+$/.test(campaign.total_deposited_yocto)) throw new Error("Invalid revenue amount.");
        if (!cancelled) { setData({ right, campaign }); setState("ready"); }
      } catch { if (!cancelled) setState("error"); }
    }
    void load();
    return () => { cancelled = true; };
  }, [tokenId, refresh]);

  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Link href="/nfts" className="inline-flex items-center gap-2 text-sm text-[#A9B6CF] hover:text-white"><ArrowLeft size={16} /> My NFTs</Link>
      <Link href="/gallery" className="inline-flex text-sm font-semibold text-[#FF8E9C]">Public NFT gallery ↗</Link>
      <button type="button" onClick={refreshData} disabled={state === "loading"} className="rounded-xl border border-[#293954] px-4 py-2 text-sm text-[#A9B6CF] hover:text-white disabled:opacity-40">Refresh ownership</button>
    </div>
    {state === "loading" && <div role="status" className={panel}><p className="text-sm text-[#A9B6CF]">Reading this NFT and its revenue agreement from NEAR...</p><div aria-hidden="true" className="mt-5 h-64 rounded-xl bg-[#0B1933] motion-safe:animate-pulse" /></div>}
    {state === "missing" && <div className={panel}><h2 className="text-xl font-semibold">Revenue right not found</h2><p className="mt-3 text-sm text-[#A9B6CF]">This token is not an existing Zinc revenue right on NEAR Testnet.</p><Link href="/campaigns" className="mt-4 inline-flex text-sm text-[#FF8E9C]">Explore campaign rights</Link></div>}
    {state === "error" && <div role="alert" className={panel}><h2 className="text-xl font-semibold">Unable to load this revenue right</h2><p className="mt-3 text-sm text-[#A9B6CF]">The RPC read failed or ownership changed during loading. Use Refresh ownership to try again.</p></div>}
    {state === "ready" && data && <RightContent data={data} accountId={accountId} />}
  </div>;
}

function RightContent({ data: { right, campaign }, accountId }: { data: RightData; accountId: string | null }) {
  const original = campaign.contributors[right.contributor_index].account_id;
  const current = accountId === right.owner_id;
  const returnedOrOriginal = right.owner_id === original;
  return <>
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.2fr)]">
      <div className="min-w-0 space-y-3"><RevenueRightCard right={right} campaignName={campaign.name} status={returnedOrOriginal ? "Original account" : "Transferred"} /><p className="px-1 text-xs leading-5 text-[#71809D]">Zinc application artwork, generated from the right’s identity. Ownership and share are read from the contract.</p></div>
      <section className={panel}>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#FF8E9C]">A share of what comes next</p>
        <h2 className="mt-3 break-words text-3xl font-semibold tracking-tight">{campaign.name}</h2>
        <p className="mt-3 break-words text-sm leading-6 text-[#A9B6CF]">This {right.role} right directs <strong className="text-white">{right.share_bps / 100}% of future campaign deposits</strong> to its current NFT owner.</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <span className="rounded-full border border-[#FF8E9C]/25 bg-[#FF8E9C]/10 px-3 py-1 text-xs text-[#FF8E9C]">NEP-171 · Testnet</span>
          {current && <span className="rounded-full bg-[#153c39] px-3 py-1 text-xs text-[#69dab8]">Current owner · You</span>}
          {!current && accountId === original && <span className="rounded-full bg-[#FF8E9C]/10 px-3 py-1 text-xs text-[#FF8E9C]">Original contributor · You</span>}
        </div>
        <dl className="mt-6 grid gap-5 sm:grid-cols-2">
          <Info label="Campaign ID" value={String(campaign.id)} /><Info label="Role / Revenue share" value={`${right.role} / ${right.share_bps / 100}%`} />
          <Info label="Token ID" value={right.token_id} copy /><Info label="NFT contract" value={ZINC_CONTRACT_ID} copy />
          <Info label="Original contributor" value={original} copy /><Info label="Current NFT owner" value={right.owner_id} copy />
        </dl>
        <div className="mt-6 flex flex-wrap gap-3 border-t border-[#293954] pt-5">
          <Link href={`/workspace/${campaign.id}`} className="rounded-xl border border-[#293954] px-4 py-3 text-sm text-[#FF8E9C]">Holder workspace</Link>
          <Link href={`/campaigns/${campaign.id}`} className="rounded-xl bg-gradient-to-r from-[#ff685b] to-[#ff8a9c] px-4 py-3 text-sm font-semibold">View campaign <ArrowUpRight className="ml-1 inline" size={15} /></Link>
          {current && <Link href={`/nfts#${encodeURIComponent(right.token_id)}`} className="rounded-xl border border-[#293954] px-4 py-3 text-sm text-[#FF8E9C]">Manage &amp; transfer in My NFTs</Link>}
        </div>
      </section>
    </div>
    <section className={panel}>
      <h2 className="flex items-center gap-2 text-xl font-semibold"><ShieldCheck size={20} className="text-[#69dab8]" /> What ownership means</h2>
      <div className="mt-5 grid gap-5 md:grid-cols-3">
        <Explanation number="01" title="Future revenue moves" text="The current owner earns this right’s share of new revenue deposited into the campaign." />
        <Explanation number="02" title="Earned revenue stays" text="A transfer preserves revenue already earned by each previous owner. They can still claim their own accrued balance." />
        <Explanation number="03" title="Treasury stays separate" text={`The campaign treasury receives ${campaign.treasury_share_bps / 100}% through its account. Its share does not move with this NFT.`} />
      </div>
      <p className="mt-5 text-xs leading-5 text-[#71809D]">Revenue depends on actual campaign deposits. This NFT does not guarantee income or automatically collect off-chain sales.</p>
    </section>
    <RightOwnershipHistory key={right.token_id} tokenId={right.token_id} campaignId={campaign.id} originalOwner={original} currentOwner={right.owner_id} accountId={accountId} />
    <section id="campaign-account-earnings" className={`${panel} scroll-mt-6`}>
      <h2 className="text-xl font-semibold">Campaign revenue context</h2>
      <p className="mt-3 break-all text-3xl font-semibold text-[#FF8E9C]">{yoctoToNear(BigInt(campaign.total_deposited_yocto))} NEAR</p>
      <p className="mt-2 text-sm text-[#A9B6CF]">Lifetime deposits across the whole campaign, shared among its contributors and treasury.</p>
      <p className="mt-4 text-xs leading-5 text-[#71809D]">Earnings below belong to your connected account across this campaign. They can include several NFTs, historical ownership, and treasury earnings. The contract does not expose separate payout totals for this individual NFT.</p>
    </section>
    <ClaimRevenueSection campaignId={campaign.id} totalDepositedYocto={campaign.total_deposited_yocto} />
    <div className="flex flex-wrap gap-5 text-sm text-[#FF8E9C]">
      <Link href={`/transactions?token=${encodeURIComponent(right.token_id)}`}>View available transfer activity <ArrowUpRight className="inline" size={15} /></Link>
      <a href={`https://testnet.nearblocks.io/address/${encodeURIComponent(right.owner_id)}`} target="_blank" rel="noopener noreferrer">Inspect current owner on explorer <ArrowUpRight className="inline" size={15} /></a>
    </div>
  </>;
}

function Explanation({ number, title, text }: { number: string; title: string; text: string }) {
  return <div className="border-t border-[#293954] pt-4"><p className="font-mono text-xs text-[#FF8E9C]">{number}</p><h3 className="mt-2 font-semibold">{title}</h3><p className="mt-2 text-sm leading-6 text-[#A9B6CF]">{text}</p></div>;
}

function Info({ label, value, copy = false }: { label: string; value: string; copy?: boolean }) {
  const [feedback, setFeedback] = useState<string | null>(null);
  async function copyValue() {
    try { await navigator.clipboard.writeText(value); setFeedback("Copied"); }
    catch { setFeedback("Copy unavailable. Select the value to copy it."); }
  }
  return <div className="min-w-0"><dt className="text-xs text-[#71809D]">{label}</dt><dd className="mt-1 break-all text-sm text-white">{value}{copy && <button type="button" onClick={copyValue} aria-label={`Copy ${label.toLowerCase()}`} className="ml-2 inline-flex align-middle text-[#A9B6CF] hover:text-[#FF8E9C]"><Copy size={13} /></button>}</dd>{feedback && <p role="status" className="mt-1 text-xs text-[#A9B6CF]">{feedback}</p>}</div>;
}
