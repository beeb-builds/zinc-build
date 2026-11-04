import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowLeft } from "lucide-react";

import DashboardShell from "../../../components/layout/DashboardShell";
import DepositRevenueForm from "../../../components/campaigns/DepositRevenueForm";
import ClaimRevenueSection from "../../../components/campaigns/ClaimRevenueSection";
import RevenueRightsSection from "../../../components/campaigns/RevenueRightsSection";
import ActivityFeed from "../../../components/activity/ActivityFeed";
import CampaignPaymentLink from "../../../components/campaigns/CampaignPaymentLink";
import CampaignRefreshButton from "../../../components/campaigns/CampaignRefreshButton";
import CampaignStatusBadge from "../../../components/campaigns/CampaignStatusBadge";
import { getCampaign, type OnChainCampaign } from "../../../lib/zinc-contract";
import { validateDiscoveryCampaigns } from "../../../lib/campaign-discovery";

export const instant = false;

type CampaignPageProps = {
  params: Promise<{ id: string }>;
};

function formatDate(timestamp: number) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    timeZone: "UTC",
  }).format(new Date(timestamp));
}

function formatShare(bps: number) {
  return `${bps / 100}%`;
}

function formatNear(yocto: string) {
  const amount = BigInt(yocto);
  const unit = BigInt("1000000000000000000000000");
  const fraction = (amount % unit).toString().padStart(24, "0").replace(/0+$/, "");
  return `${amount / unit}${fraction ? `.${fraction}` : ""} NEAR`;
}

function CampaignState({ title, message, retry = false }: { title: string; message: string; retry?: boolean }) {
  return (
    <div className="rounded-2xl border border-[#293954] bg-[#122344] p-8 text-center">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      <p className="mt-2 text-sm text-[#A9B6CF]">{message}</p>
      {retry && <div className="mt-5 flex justify-center"><CampaignRefreshButton retry /></div>}
    </div>
  );
}

async function CampaignDetails({ params }: CampaignPageProps) {
  // Keep the RPC read and time-dependent status out of prerendering.
  await connection();
  const { id } = await params;
  const campaignId = Number(id);

  if (!/^\d+$/.test(id) || !Number.isSafeInteger(campaignId)) {
    return <CampaignState title="Campaign not found" message="This campaign ID is not valid. Return to campaigns to find a campaign." />;
  }

  let campaign: OnChainCampaign | null;
  try {
    campaign = await getCampaign(campaignId);
    if (campaign !== null) {
      validateDiscoveryCampaigns([campaign]);
      const allocation = campaign.contributors.reduce((total, contributor) => total + contributor.share_bps, campaign.treasury_share_bps);
      if (campaign.id !== campaignId || typeof campaign.treasury_account !== "string" || !campaign.treasury_account || !campaign.contributors.length || allocation !== 10000) {
        throw new Error("The campaign response does not match the requested campaign.");
      }
    }
  } catch (error) {
    console.error("Failed to load Zinc campaign:", error);
    return <CampaignState title="Unable to load campaign" message="Zinc could not load complete campaign data from NEAR Testnet. This does not mean the campaign is missing or that a transaction failed." retry />;
  }

  if (!campaign) {
    return <CampaignState title="Campaign not found" message="This campaign does not exist on NEAR Testnet. Return to campaigns to find a campaign." />;
  }

  // eslint-disable-next-line react-hooks/purity -- Request-time server snapshot after connection(); the client badge owns later clock updates.
  const now = Date.now();
  const status = now < campaign.start_timestamp_ms
    ? "Scheduled"
    : now > campaign.end_timestamp_ms ? "Ended" : "Active";
  const totalBps = campaign.contributors.reduce(
    (total, contributor) => total + contributor.share_bps,
    campaign.treasury_share_bps,
  );

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-[#293954] bg-[#122344] p-6 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#71809D]">
              Campaign #{campaign.id}
            </p>
            <h2 className="mt-2 break-words text-3xl font-semibold text-white">{campaign.name}</h2>
          </div>
          <CampaignStatusBadge startTimestampMs={campaign.start_timestamp_ms} endTimestampMs={campaign.end_timestamp_ms} initialStatus={status} />
        </div>
        <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-6 text-[#A9B6CF]">{campaign.description}</p>
        <dl className="mt-6 grid gap-5 border-t border-[#293954] pt-6 sm:grid-cols-2 lg:grid-cols-4">
          <Detail label="Creator account" value={campaign.creator} />
          <Detail label="Start date (UTC)" value={formatDate(campaign.start_timestamp_ms)} />
          <Detail label="End date (UTC)" value={formatDate(campaign.end_timestamp_ms)} />
          <Detail label="Contributor count" value={String(campaign.contributors.length)} />
          <Detail label="Total Revenue Deposited" value={formatNear(campaign.total_deposited_yocto)} />
        </dl>
        <p className="mt-4 text-xs leading-5 text-[#71809D]">Deposit eligibility uses NEAR block time. The displayed status follows your device clock; the contract makes the final check when a deposit executes. Ending a campaign does not remove earned claimable revenue.</p>
        <nav aria-label="Campaign sections" className="mt-5 flex flex-wrap gap-3 text-sm font-semibold text-[#FF8E9C]"><Link href="#project-team" className="rounded-xl border border-[#293954] px-3 py-2">Meet the team</Link><Link href="#revenue-rights" className="rounded-xl border border-[#293954] px-3 py-2">Inspect NFTs</Link><Link href="#deposit-revenue" className="rounded-xl border border-[#293954] px-3 py-2">Deposit revenue</Link><Link href="#claim-revenue" className="rounded-xl border border-[#293954] px-3 py-2">Claim earnings</Link></nav>
        <div className="mt-6 flex flex-wrap items-start justify-between gap-3 border-t border-[#293954] pt-5">
          <p className="max-w-lg text-xs leading-5 text-[#71809D]">Campaign data is a snapshot from NEAR Testnet. Refresh to check deposits made elsewhere and reload ownership, earnings and available activity.</p>
          <CampaignRefreshButton />
        </div>
      </section>

      <RevenueRightsSection key={campaign.id} campaign={campaign} />

      <div id="deposit-revenue" className="scroll-mt-6"><DepositRevenueForm
        key={campaign.id}
        campaignId={campaign.id}
        startTimestampMs={campaign.start_timestamp_ms}
        endTimestampMs={campaign.end_timestamp_ms}
        initiallyActive={status === "Active"}
      /></div>
      <CampaignPaymentLink campaignId={campaign.id} />
      <Link href={`/workspace/${campaign.id}`} className="inline-flex rounded-xl border border-[#FF8E9C]/25 px-4 py-3 text-sm font-semibold text-[#FF8E9C]">Open holder workspace ↗</Link>

      <ClaimRevenueSection campaignId={campaign.id} totalDepositedYocto={campaign.total_deposited_yocto} />

      <ActivityFeed campaignId={campaign.id} compact />

      <section className="rounded-2xl border border-[#FF8E9C]/20 bg-[#122344] p-6 md:p-8">
        <h2 className="text-xl font-semibold text-white">Project treasury</h2>
        <span className="mt-3 inline-flex rounded-full border border-[#FF8E9C]/25 bg-[#FF8E9C]/10 px-3 py-1 text-xs font-semibold text-[#FF8E9C]">Treasury · Account-based</span>
        <p className="mt-3 text-sm leading-6 text-[#A9B6CF]">Treasury revenue belongs to the treasury account. It is not NFT-based and does not transfer with contributor NFTs.</p>
        <dl className="mt-5 grid gap-5 sm:grid-cols-2">
          <Detail label="Treasury account" value={campaign.treasury_account} />
          <Detail label="Treasury percentage" value={formatShare(campaign.treasury_share_bps)} />
        </dl>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[#293954] pt-5">
          <p className="text-sm text-[#A9B6CF]">Total allocation</p>
          <p className="text-3xl font-semibold text-[#FF8E9C]">{formatShare(totalBps)}</p>
        </div>
      </section>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-[#71809D]">{label}</dt>
      <dd className="mt-1 break-words text-sm font-medium text-white [overflow-wrap:anywhere]">{value}</dd>
    </div>
  );
}

export default function CampaignPage({ params }: CampaignPageProps) {
  return (
    <DashboardShell title="Campaign details" subtitle="Programmable revenue rights on NEAR">
      <div className="mx-auto w-full max-w-7xl">
        <Link href="/campaigns" className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-[#A9B6CF] transition hover:text-white">
          <ArrowLeft size={16} />
          Back to campaigns
        </Link>
        <Suspense fallback={<p role="status" className="text-sm text-[#A9B6CF]">Loading campaign…</p>}>
          <CampaignDetails params={params} />
        </Suspense>
      </div>
    </DashboardShell>
  );
}
