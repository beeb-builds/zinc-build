"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { yoctoToNear } from "near-api-js";
import { readWalletDashboard, type WalletDashboard as WalletSnapshot } from "../../lib/dashboard-wallet";
import type { OnChainCampaign } from "../../lib/zinc-contract";

type Props = { accountId: string | null; campaigns: OnChainCampaign[] | null; campaignError: boolean; onConnect: () => void };
export default function WalletDashboard({ accountId, campaigns, campaignError, onConnect }: Props) {
  const [snapshot, setSnapshot] = useState<{ campaigns: OnChainCampaign[]; value: WalletSnapshot } | null>(null);
  const [failure, setFailure] = useState<{ accountId: string; campaigns: OnChainCampaign[] } | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!accountId || !campaigns) return;
    const account = accountId, items = campaigns;
    void readWalletDashboard(items, account).then((value) => { if (!cancelled) setSnapshot({ campaigns: items, value }); })
      .catch(() => { if (!cancelled) setFailure({ accountId: account, campaigns: items }); });
    return () => { cancelled = true; };
  }, [accountId, campaigns]);
  // Scope both success and failure to the exact wallet and RPC snapshot, including during render before effects run.
  const current = accountId && snapshot?.value.accountId === accountId && snapshot.campaigns === campaigns ? snapshot.value : null;
  const failed = campaignError || (failure?.accountId === accountId && failure?.campaigns === campaigns);
  const amount = (value: bigint | null | undefined) => value == null ? "Unavailable" : `${yoctoToNear(value)} NEAR`;
  const pending = Boolean(accountId && !current && !failed);
  const metric = (label: string, value: string, helper: string) => <div key={label} className="zinc-interactive-surface min-w-0 rounded-2xl border border-white/[0.07] bg-[#0b1b34] p-4"><dt className="text-xs text-[#aebbd0]">{label}</dt><dd className="mt-3 break-words text-2xl font-semibold [overflow-wrap:anywhere]">{pending ? "Loading…" : failed ? "Unavailable" : value}</dd><p className="mt-2 text-xs leading-5 text-[#8fa0bc]">{helper}</p></div>;
  return <section data-zinc-reveal aria-label="Your wallet overview" className="mb-6 min-w-0 rounded-[28px] border border-[#ff7568]/20 bg-gradient-to-br from-[#142947] to-[#10213d] p-4 sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#ff9988]">Personal overview</p><h3 className="mt-2 text-xl font-semibold">Your wallet</h3><p className="mt-2 max-w-2xl text-sm leading-6 text-[#aebbd0]">Your earnings and campaign relationships come from this account. Platform totals below cover everyone on Zinc.</p></div><span className="rounded-full border border-[#69dab8]/20 bg-[#153c39] px-3 py-1 text-xs text-[#69dab8]">{accountId ? "Wallet-specific" : "Wallet not connected"}</span></div>
    {!accountId ? <div className="mt-5 flex flex-wrap items-center gap-4"><button type="button" onClick={onConnect} className="rounded-xl bg-gradient-to-r from-[#ff685b] to-[#ff8a9c] px-4 py-3 text-sm font-semibold">Connect to view your dashboard</button><p className="text-sm text-[#aebbd0]">Public campaign totals remain visible below.</p></div> : <>
      <p className="mt-4 break-all text-xs text-[#aebbd0]" data-wallet-account>{accountId}</p>
      {pending && <p role="status" className="mt-3 text-sm text-[#aebbd0]">Reading this wallet&apos;s on-chain balances and NFTs…</p>}
      {failed && <p role="alert" className="mt-3 text-sm text-[#ff9988]">Your wallet overview could not be loaded. Select Refresh data to retry.</p>}
      {current?.warnings.map((warning) => <p key={warning} role="status" className="mt-3 text-sm text-[#ff9988]">{warning} Select Refresh data to retry.</p>)}
      <dl className="mt-5 grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metric("Your claimable revenue", amount(current?.claimable), "Includes retained historical and treasury earnings")}
        {metric("Your claimed revenue", amount(current?.claimed), "Completed claims across your campaign balances")}
        {metric("Your current NFTs", current?.ownedCount == null ? "Unavailable" : String(current.ownedCount), "Revenue-right NFTs currently owned by this account")}
        {metric("Your related campaigns", current?.relatedCount == null ? "Unavailable" : String(current.relatedCount), "Created, original/current rights, treasury or recorded earnings")}
      </dl>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3"><h4 className="font-semibold">Your campaigns &amp; rights</h4><Link href="/earnings" className="text-sm text-[#ff9988]">View all earnings ↗</Link></div>
      {current && current.rows.length === 0 && <p className="mt-3 rounded-xl bg-[#0b1b34] p-4 text-sm leading-6 text-[#aebbd0]">{current.warnings.length ? "No campaign relationships found in the available reads. Complete results require refreshing the unavailable data." : "This wallet has no campaign relationships or earnings yet. Create a campaign or receive a revenue-right NFT to get started. Other wallets’ campaigns are visible in the public platform section."}</p>}
      <div className="mt-3 space-y-3">{current?.rows.slice(0, 5).map((row) => <Link key={row.campaign.id} href={`/campaigns/${row.campaign.id}`} className="zinc-interactive-surface block min-w-0 rounded-2xl border border-white/[0.07] bg-[#0b1b34] p-4">
        <div className="flex flex-wrap justify-between gap-2"><p className="break-words font-semibold [overflow-wrap:anywhere]">{row.campaign.name} <span className="text-xs text-[#8fa0bc]">#{row.campaign.id}</span></p><span className="text-sm text-[#69dab8]">{amount(row.claimable)} claimable</span></div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-[#aebbd0]">{[row.creator && "Campaign creator", row.treasury && "Treasury", row.originalContributor && "Original contributor", current.ownedCount !== null && row.currentRights > 0 && `Current NFT owner · ${row.currentRights} right${row.currentRights === 1 ? "" : "s"}`, current.ownedCount !== null && row.currentRights === 0 && ((row.claimable ?? BigInt(0)) > BigInt(0) || (row.claimed ?? BigInt(0)) > BigInt(0)) && !row.treasury && "Retained historical earnings"].filter(Boolean).map((badge) => <span key={String(badge)} className="rounded-full border border-white/10 px-2 py-1">{badge}</span>)}</div>
        <p className="mt-3 text-xs text-[#8fa0bc]">{amount(row.claimed)} claimed · Open campaign ↗</p>
      </Link>)}</div>
      <div className="mt-4 flex flex-wrap gap-4 text-sm text-[#ff9988]"><Link href="/nfts">Your owned NFTs ↗</Link><Link href="/campaigns/new">Create a campaign ↗</Link></div>
    </>}
  </section>;
}
