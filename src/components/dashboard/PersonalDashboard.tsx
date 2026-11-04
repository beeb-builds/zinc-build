"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RefreshCw } from "lucide-react";
import DashboardShell from "../layout/DashboardShell";
import WalletDashboard from "./WalletDashboard";
import ProjectOnboarding from "./ProjectOnboarding";
import { useWallet } from "../wallet/WalletProvider";
import { useReadRefresh } from "../data/useReadRefresh";
import { getCampaigns, type OnChainCampaign } from "../../lib/zinc-contract";
import { validateDiscoveryCampaigns } from "../../lib/campaign-discovery";

export default function PersonalDashboard() {
  const { accountId, connect } = useWallet();
  const { version, refresh } = useReadRefresh();
  const [data, setData] = useState<{ version: number; campaigns: OnChainCampaign[] | null; failed: boolean } | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!accountId) return;
    void getCampaigns().then((campaigns) => { validateDiscoveryCampaigns(campaigns); if (!cancelled) setData({ version, campaigns, failed: false }); })
      .catch(() => { if (!cancelled) setData({ version, campaigns: null, failed: true }); });
    return () => { cancelled = true; };
  }, [accountId, version]);
  const current = data?.version === version ? data : null;
  return <DashboardShell title="Your dashboard" subtitle="Your account’s earnings, revenue-right NFTs and project relationships."
    headerActions={<button type="button" onClick={refresh} disabled={!accountId || !current} className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-[#0f213d] px-4 py-3 text-sm text-[#aebbd0] disabled:opacity-40"><RefreshCw size={16} />Refresh your data</button>}>
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#ff9988]">Your place in Zinc</p><h2 className="mt-2 text-2xl font-semibold">Projects are built by people. Rights belong to accounts.</h2></div><Link href="/explore" className="rounded-xl border border-[#ff9988]/25 px-4 py-3 text-sm font-semibold text-[#ff9988]">Explore Zinc ↗</Link></div>
    <WalletDashboard accountId={accountId} campaigns={current?.campaigns ?? null} campaignError={current?.failed ?? false} onConnect={connect} />
    <ProjectOnboarding />
    <section className="rounded-2xl border border-white/[0.07] bg-[#10213d] p-5"><h2 className="text-lg font-semibold">Looking for the whole platform?</h2><p className="mt-3 text-sm leading-6 text-[#aebbd0]">Total deposited revenue, all campaigns, public NFTs and platform charts live in Explore Zinc. They are separate from your personal balances.</p><Link href="/explore" className="mt-4 inline-flex text-sm font-semibold text-[#ff9988]">Open the platform overview ↗</Link></section>
  </DashboardShell>;
}
