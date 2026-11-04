import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import CampaignPayment from "../../../components/campaigns/CampaignPayment";
import { getCampaign, getCampaignRights, type OnChainCampaign, type OnChainRevenueRight } from "../../../lib/zinc-contract";

export const instant = false;
type PaymentPageProps = { params: Promise<{ id: string }> };

async function PaymentContent({ params }: PaymentPageProps) {
  await connection();
  const { id } = await params;
  if (!/^\d+$/.test(id) || !Number.isSafeInteger(Number(id))) return <PaymentState title="Campaign not found" message="This support link has an invalid campaign ID." />;
  let campaign: OnChainCampaign | null;
  let rights: OnChainRevenueRight[] | null;
  let validRights = false;
  try {
    [campaign, rights] = await Promise.all([getCampaign(Number(id)), getCampaignRights(Number(id)).catch(() => null)]);
    if (campaign) {
      const loadedCampaign = campaign;
      if (typeof campaign.total_deposited_yocto !== "string" || !/^\d+$/.test(campaign.total_deposited_yocto)) throw new Error("Invalid revenue total.");
      validRights = Array.isArray(rights) && rights.length === campaign.contributors.length &&
      new Set(rights.map((right) => right.contributor_index)).size === rights.length &&
      rights.every((right) => right.campaign_id === loadedCampaign.id && loadedCampaign.contributors[right.contributor_index] && right.owner_id);
    }
  } catch {
    return <PaymentState title="Unable to load this campaign" message="Zinc could not read campaign details from NEAR Testnet. Reload this page to try again." />;
  }
  if (!campaign) return <PaymentState title="Campaign not found" message="This campaign does not exist on NEAR Testnet." />;
  // eslint-disable-next-line react-hooks/purity -- Server request time is intentionally read after connection(), never during cached prerendering.
  const now = Date.now();
  return <CampaignPayment campaign={campaign} rights={validRights ? rights : null} initiallyActive={now >= campaign.start_timestamp_ms && now <= campaign.end_timestamp_ms} />;
}

function PaymentState({ title, message }: { title: string; message: string }) {
  return <section className="rounded-2xl border border-[#293954] bg-[#122344] p-8"><h1 className="text-2xl font-semibold">{title}</h1><p className="mt-3 text-sm text-[#A9B6CF]">{message}</p><Link href="/campaigns" className="mt-5 inline-flex text-sm text-[#FF8E9C]">Explore campaigns</Link></section>;
}

export default function PaymentPage({ params }: PaymentPageProps) {
  return <div className="min-h-screen bg-[#07142d] text-white">
    <header className="border-b border-white/[0.06] px-5 py-5"><div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
      <Link href="/" aria-label="Zinc home" className="flex items-center gap-3 font-semibold tracking-tight"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#ff675a] to-[#ff8b9d] text-xl">Z</span><span>Zinc <span className="ml-2 text-xs font-normal text-[#A9B6CF]">Campaign support</span></span></Link>
      <div className="flex items-center gap-4"><span className="rounded-full border border-[#FF8E9C]/25 bg-[#FF8E9C]/10 px-3 py-1 text-xs text-[#FF8E9C]">NEAR Testnet</span><Link href="/campaigns" className="text-sm text-[#A9B6CF] hover:text-white">Open Zinc ↗</Link></div>
    </div></header>
    <main className="mx-auto max-w-6xl px-5 py-8 md:py-12"><Suspense fallback={<p role="status" className="text-sm text-[#A9B6CF]">Loading campaign support page...</p>}><PaymentContent params={params} /></Suspense></main>
    <footer className="mx-auto max-w-6xl px-5 pb-8 text-xs leading-5 text-[#71809D]">Powered by Zinc · Programmable revenue rights on NEAR. This prototype uses testnet NEAR.</footer>
  </div>;
}
