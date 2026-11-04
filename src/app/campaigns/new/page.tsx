import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import CreateCampaignForm from "../../../components/campaigns/CreateCampaignForm";
import DashboardShell from "../../../components/layout/DashboardShell";

export default function NewCampaignPage() {
  return (
    <DashboardShell
      title="Create Campaign"
      subtitle="Define contributor rights and campaign revenue allocation."
    >
      <Link
        href="/campaigns"
        className="mb-6 inline-flex items-center gap-2 text-sm text-[#7185a1] transition hover:text-white"
      >
        <ArrowLeft size={16} />
        Back to campaigns
      </Link>

      <div className="mb-7">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#ff7568]">
          New Campaign
        </p>

        <h2 className="mt-2 text-2xl font-semibold">
          Configure revenue rights
        </h2>

        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#7085a2]">
          Set the campaign period, contributors and exact revenue allocation.
          Confirm the agreement in your wallet to create the campaign on NEAR
          Testnet and mint a revenue-right NFT for each contributor.
        </p>
      </div>

      <CreateCampaignForm />
    </DashboardShell>
  );
}
