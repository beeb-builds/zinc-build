"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { yoctoToNear } from "near-api-js";
import { useWallet } from "../wallet/WalletProvider";
import { useReadRefresh } from "../data/useReadRefresh";
import RevenueRightCard from "../nfts/RevenueRightCard";
import ProjectTeamRoster from "./ProjectTeamRoster";
import { validateCampaignRights } from "../../lib/public-rights";
import { getCampaignRights, getClaimable, getClaimed, type OnChainCampaign, type OnChainRevenueRight } from "../../lib/zinc-contract";

const badge = "inline-flex rounded-full border border-[#FF8E9C]/25 bg-[#FF8E9C]/10 px-3 py-1 text-xs font-semibold text-[#FF8E9C]";

export default function RevenueRightsSection({ campaign }: { campaign: OnChainCampaign }) {
  const { accountId } = useWallet();
  const [rights, setRights] = useState<OnChainRevenueRight[] | null>(null);
  const [error, setError] = useState(false);
  const { version: refresh, refresh: refreshData } = useReadRefresh();

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Discard stale ownership before the cancellable external rights refresh.
    setRights(null);
    setError(false);
    getCampaignRights(campaign.id).then((result) => {
      const verified = validateCampaignRights(campaign, result);
      if (!cancelled) setRights(verified);
    }).catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [campaign, refresh]);

  const relevant = Boolean(accountId && (campaign.contributors.some((contributor) => contributor.account_id === accountId) || rights?.some((right) => right.owner_id === accountId)));

  return (
    <section id="revenue-rights" className="scroll-mt-6 rounded-2xl border border-[#293954] bg-[#122344] p-6 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-white">Project team &amp; revenue rights</h2>
        <button type="button" onClick={refreshData} disabled={!rights && !error} className="rounded-xl border border-[#293954] px-4 py-2 text-sm text-[#A9B6CF] hover:text-white disabled:opacity-40">Refresh rights</button>
      </div>
      <p className="mt-4 text-sm leading-6 text-[#A9B6CF]">Future revenue follows the current NFT owner. Revenue earned before a transfer remains with the previous owner.</p>
      <p className="mt-2 text-xs leading-5 text-[#71809D]">Original contributor: the account allocated the right at campaign creation. Current NFT owner: the account that controls its future revenue now.</p>
      {error && <p role="alert" className="mt-4 text-sm text-[#FF8E9C]">NFT ownership could not be loaded. Original allocations are shown below; current ownership is unavailable. Use Refresh rights to retry.</p>}
      {!rights && !error && <p role="status" className="mt-4 text-sm text-[#A9B6CF]">Loading current revenue-right owners...</p>}
      <ProjectTeamRoster campaign={campaign} rights={rights} accountId={accountId} />
      <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-[#293954] pt-6"><h3 className="text-lg font-semibold text-white">Revenue Rights · Contributor NFTs</h3><Link href="/gallery" className="text-sm font-semibold text-[#ff9988]">Browse the public NFT gallery ↗</Link></div>
      <div className="mt-5 grid items-start gap-4 xl:grid-cols-2">
        {campaign.contributors.map((contributor, index) => {
          const right = rights?.find((item) => item.contributor_index === index);
          const currentOwner = Boolean(accountId && right?.owner_id === accountId);
          const originalOwner = accountId === contributor.account_id;
          return <article key={index} className="rounded-xl border border-[#293954] bg-[#0B1933] p-5">
            {right && <div className="mb-4"><RevenueRightCard right={right} campaignName={campaign.name} status={currentOwner ? "Owned by you" : right.owner_id === contributor.account_id ? "Original account" : "Transferred"} /></div>}
            <div className="flex flex-wrap gap-2">
              <span className={badge}>{(right?.share_bps ?? contributor.share_bps) / 100}% Revenue Right</span>
              {right && <span className={badge}>{right.owner_id === contributor.account_id ? "Original Owner" : "Transferred"}</span>}
              {currentOwner && <span className="rounded-full bg-[#153c39] px-3 py-1 text-xs font-semibold text-[#69dab8]">Current Owner · You</span>}
            </div>
            <dl className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Role" value={right?.role ?? contributor.role} />
              <Field label="Token ID" value={right?.token_id ?? (error ? "Unavailable" : "Loading...")} />
              <Field label="Original contributor account" value={contributor.account_id} />
              <Field label="Current NFT owner" value={right?.owner_id ?? (error ? "Unavailable" : "Loading...")} />
            </dl>
            {originalOwner && !currentOwner && right && <p className="mt-4 text-sm text-[#A9B6CF]">You are the original contributor and no longer own this right. Your previously earned revenue remains yours.</p>}
          </article>;
        })}
        {campaign.contributors.length === 0 && <p className="text-sm text-[#A9B6CF]">This campaign has no contributor NFT rights.</p>}
      </div>
      {!accountId ? <p className="mt-5 text-sm text-[#A9B6CF]">Connect your wallet to see your ownership relationship and campaign revenue balances.</p>
        : relevant ? <WalletRevenue key={`${campaign.id}:${accountId}`} campaign={campaign} accountId={accountId} refresh={refresh} />
        : <p className="mt-5 text-sm text-[#A9B6CF]">{rights ? "Your wallet is not an original contributor or current NFT owner. If you previously held a right, your historical revenue is still available in Claim Revenue above." : "Your revenue balances remain available in Claim Revenue above while ownership is unavailable."}</p>}
      <Link href="/nfts" className="mt-5 inline-flex text-sm font-semibold text-[#FF8E9C]">Manage and transfer your rights in My NFTs</Link>
    </section>
  );
}

function WalletRevenue({ campaign, accountId, refresh }: { campaign: OnChainCampaign; accountId: string; refresh: number }) {
  const [balances, setBalances] = useState<{ claimable: string; claimed: string } | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Clear the previous external financial snapshot before re-reading this campaign/account.
    setBalances(null);
    setError(false);
    Promise.all([getClaimable(campaign.id, accountId), getClaimed(campaign.id, accountId)]).then(([claimable, claimed]) => {
      if ([claimable, claimed].some((amount) => typeof amount !== "string" || !/^\d+$/.test(amount))) throw new Error("Invalid revenue balance.");
      if (!cancelled) setBalances({ claimable, claimed });
    }).catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [campaign, accountId, refresh]);
  return <div className="mt-5 border-t border-[#293954] pt-5">
    <h3 className="font-semibold text-white">Your historical revenue · campaign account totals</h3>
    <p className="mt-2 break-all text-xs leading-5 text-[#71809D]">{accountId} · Includes all earned revenue from this campaign, including other rights or treasury shares. These are not per-NFT amounts. Claim Revenue above shows and refreshes your payout balances.</p>
    {error ? <p role="alert" className="mt-3 text-sm text-[#FF8E9C]">Revenue balances could not be loaded. Use Refresh rights to retry.</p>
      : !balances ? <p role="status" className="mt-3 text-sm text-[#A9B6CF]">Loading your campaign revenue...</p>
      : <dl className="mt-4 grid gap-4 sm:grid-cols-2"><Field label="Historical Claimable" value={`${yoctoToNear(BigInt(balances.claimable))} NEAR`} /><Field label="Historical Claimed" value={`${yoctoToNear(BigInt(balances.claimed))} NEAR`} /></dl>}
  </div>;
}

function Field({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><dt className="text-xs text-[#71809D]">{label}</dt><dd className="mt-1 break-all text-sm font-medium text-white">{value}</dd></div>;
}
