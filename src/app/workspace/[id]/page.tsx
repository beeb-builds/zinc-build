import { Suspense } from "react";
import { connection } from "next/server";
import DashboardShell from "../../../components/layout/DashboardShell";
import CampaignWorkspace from "../../../components/workspace/CampaignWorkspace";

export const instant = false;
type Props = { params: Promise<{ id: string }> };
async function Content({ params }: Props) {
  await connection();
  const { id } = await params;
  if (!/^\d+$/.test(id) || !Number.isSafeInteger(Number(id))) return <p className="text-sm text-[#FF8E9C]">Invalid campaign ID.</p>;
  return <CampaignWorkspace campaignId={Number(id)} />;
}
export default function WorkspacePage({ params }: Props) {
  return <DashboardShell title="Campaign workspace" subtitle="Private campaign resources for current right holders and the campaign creator.">
    <div className="mx-auto max-w-4xl"><Suspense fallback={<p role="status" className="text-sm text-[#A9B6CF]">Opening workspace...</p>}><Content params={params} /></Suspense></div>
  </DashboardShell>;
}
