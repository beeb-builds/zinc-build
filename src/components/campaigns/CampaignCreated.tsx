"use client";

import { useEffect, useRef, useState, type Ref } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import type { CampaignConfirmation } from "../../lib/campaign-confirmation";
import { getCampaign, getCampaignRights, type OnChainCampaign, type OnChainRevenueRight } from "../../lib/zinc-contract";
import { useReadRefresh } from "../data/useReadRefresh";
import RevenueRightCard, { rightHref } from "../nfts/RevenueRightCard";
import CampaignPaymentLink from "./CampaignPaymentLink";

type Details = { campaign: OnChainCampaign | null; rights: OnChainRevenueRight[] | null };

export default function CampaignCreated({ confirmation }: { confirmation: CampaignConfirmation }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, []);
  const [details, setDetails] = useState<Details>({ campaign: null, rights: null });
  const [loading, setLoading] = useState(true);
  const { version, refresh } = useReadRefresh();
  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Invalidate the previous RPC snapshot before reading the newly confirmed campaign or refresh.
    setLoading(true); setDetails({ campaign: null, rights: null });
    if (confirmation.campaignId === null) { setLoading(false); return; }
    const id = confirmation.campaignId;
    void Promise.allSettled([getCampaign(id), getCampaignRights(id)]).then(([campaignResult, rightsResult]) => {
      if (cancelled) return;
      const campaign = campaignResult.status === "fulfilled" && campaignResult.value?.id === id ? campaignResult.value : null;
      let rights = rightsResult.status === "fulfilled" ? rightsResult.value : null;
      if (!campaign || !rights || rights.length !== campaign.contributors.length || new Set(rights.map((right) => right.token_id)).size !== rights.length ||
        new Set(rights.map((right) => right.contributor_index)).size !== rights.length || rights.some((right) => {
          const contributor = campaign.contributors[right.contributor_index];
          return !contributor || right.campaign_id !== id || right.token_id !== `campaign:${id}:right:${right.contributor_index}` ||
            right.share_bps !== contributor.share_bps || right.role !== contributor.role || !right.owner_id;
        })) rights = null;
      setDetails({ campaign, rights }); setLoading(false);
    });
    return () => { cancelled = true; };
  }, [confirmation.campaignId, version]);
  return <CampaignCreatedView confirmation={confirmation} {...details} loading={loading} onRefresh={refresh} headingRef={heading} />;
}

export function CampaignCreatedView({ confirmation: { campaignId, hash }, campaign, rights, loading, onRefresh, headingRef }:
  { confirmation: CampaignConfirmation; loading: boolean; onRefresh: () => void; headingRef?: Ref<HTMLHeadingElement> } & Details) {
  return <div className="mx-auto max-w-5xl space-y-6">
    <section className="rounded-[28px] border border-[#69dab8]/20 bg-[#10213d] p-6 md:p-8">
      <div role="status" className="flex items-center gap-3 text-[#69dab8]"><CheckCircle2 size={26} /><h2 ref={headingRef} tabIndex={-1} className="text-2xl font-semibold outline-none">Campaign created on NEAR</h2></div>
      <p className="mt-4 text-sm leading-6 text-[#A9B6CF]">Your creation transaction is confirmed. The saved draft has been cleared where browser storage is available. You do not need to submit it again.</p>
      {campaign && <p className="mt-4 break-words text-xl font-semibold text-white">{campaign.name} · Campaign #{campaign.id}</p>}
      {!campaign && campaignId !== null && <p className="mt-4 text-sm text-white">Campaign #{campaignId}</p>}
      <div className="mt-5 flex flex-wrap gap-3">
        {campaignId !== null && <Link href={`/campaigns/${campaignId}`} className="rounded-xl bg-gradient-to-r from-[#ff685b] to-[#ff8a9c] px-4 py-3 text-sm font-semibold text-white">Open your campaign</Link>}
        {campaignId !== null && <Link href="#created-rights" className="rounded-xl border border-[#69dab8]/30 px-4 py-3 text-sm font-semibold text-[#69dab8]">Inspect the campaign’s minted NFTs ↓</Link>}
        <Link href="/campaigns" className="rounded-xl border border-[#293954] px-4 py-3 text-sm text-[#A9B6CF]">All campaigns</Link>
        <Link href="/nfts" className="rounded-xl border border-[#293954] px-4 py-3 text-sm text-[#FF8E9C]">View NFTs owned by your wallet</Link>
      </div>
      {hash && <a href={`https://testnet.nearblocks.io/txns/${encodeURIComponent(hash)}`} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex text-sm text-[#FF8E9C]">View creation transaction ↗</a>}
      <p className="mt-4 text-xs leading-5 text-[#71809D]">Contributor NFTs belong to the recipient wallets you specified. Creating a campaign does not mean your wallet owns every right. Treasury remains account-based.</p>
    </section>
    {campaignId === null ? <section className="rounded-2xl border border-[#293954] bg-[#122344] p-6"><h3 className="font-semibold text-white">Find your campaign</h3><p className="mt-3 text-sm leading-6 text-[#A9B6CF]">The transaction succeeded, but its returned campaign ID could not be read. Open the transaction or campaign list to find it. This is not a failed creation; do not submit the same campaign again.</p></section> : <>
      <section id="created-rights" className="scroll-mt-6 rounded-2xl border border-[#293954] bg-[#122344] p-6 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-xl font-semibold text-white">Your campaign&apos;s revenue-right NFTs</h3><button type="button" onClick={onRefresh} disabled={loading} className="rounded-xl border border-[#293954] px-4 py-2 text-sm text-[#A9B6CF] disabled:opacity-40">Refresh campaign &amp; rights</button></div>
        {loading ? <p role="status" className="mt-5 text-sm text-[#A9B6CF]">Reading the created campaign and NFT rights from NEAR...</p>
          : !campaign || !rights ? <p role="alert" className="mt-5 text-sm leading-6 text-[#FF8E9C]">Creation is confirmed, but the complete campaign and NFT details could not be loaded yet. Refresh this section or open your campaign. Do not create it again.</p>
          : <><p className="mt-4 text-sm leading-6 text-[#A9B6CF]">{rights.length} revenue-right {rights.length === 1 ? "NFT" : "NFTs"} read from the contract. These cards show real token IDs and current owners.</p><div className="mt-5 grid gap-4 sm:grid-cols-2">{rights.map((right) => <div key={right.token_id} className="min-w-0"><RevenueRightCard right={right} campaignName={campaign.name} /><Link href={rightHref(right.token_id)} className="mt-3 block break-all text-sm font-semibold text-[#ff9988]">Open minted NFT · {right.token_id} ↗</Link></div>)}</div><Link href={`/campaigns/${campaignId}#project-team`} className="mt-5 inline-flex text-sm font-semibold text-[#ff9988]">View project team &amp; allocations ↗</Link></>}
      </section>
      <CampaignPaymentLink campaignId={campaignId} />
      <section className="rounded-2xl border border-[#293954] bg-[#122344] p-6"><h3 className="font-semibold text-white">What comes next</h3><p className="mt-3 text-sm leading-6 text-[#A9B6CF]">Share the support link. Revenue can be deposited during the campaign&apos;s active dates. Current holders earn their share of new deposits; transferring a right keeps previously earned revenue with its former owner.</p><Link href={`/workspace/${campaignId}`} className="mt-4 inline-flex text-sm text-[#FF8E9C]">Open the creator / holder workspace ↗</Link></section>
    </>}
  </div>;
}
