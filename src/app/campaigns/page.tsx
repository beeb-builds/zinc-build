import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { Plus } from "lucide-react";
import DashboardShell from "../../components/layout/DashboardShell";
import CampaignExplorer from "../../components/campaigns/CampaignExplorer";
import { getCampaigns, type OnChainCampaign } from "../../lib/zinc-contract";
import { validateDiscoveryCampaigns } from "../../lib/campaign-discovery";

export const instant = false;

async function CampaignData() {
  await connection();
  let campaigns: OnChainCampaign[] | null = null;
  try {
    campaigns = await getCampaigns();
    validateDiscoveryCampaigns(campaigns);
  } catch {
    campaigns = null;
  }
  // eslint-disable-next-line react-hooks/purity -- Request-time snapshot after connection(), not a replayed client render.
  const initialTime = Date.now();
  return <CampaignExplorer initialCampaigns={campaigns} initialTime={initialTime} />;
}

export default function CampaignsPage() {
  return <DashboardShell title="Campaigns" subtitle="Programmable revenue rights on NEAR">
    <div className="mx-auto w-full max-w-7xl">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="mb-2 text-sm font-medium text-[#FF8E9C]">Revenue rights</p><h1 className="text-3xl font-semibold tracking-tight text-white">Campaigns</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[#A9B6CF]">Explore projects, their deposited revenue and contributor NFT allocations. Future revenue follows the current revenue-right owner.</p></div>
        <Link href="/campaigns/new" className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#FF685B] px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90"><Plus size={17} />Create Campaign</Link>
      </div>
      <Suspense fallback={<div role="status" className="rounded-2xl border border-[#293954] bg-[#122344] p-6 text-sm text-[#A9B6CF]">Reading campaigns from NEAR Testnet...</div>}><CampaignData /></Suspense>
    </div>
  </DashboardShell>;
}
