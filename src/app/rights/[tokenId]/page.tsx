import { Suspense } from "react";
import { connection } from "next/server";
import DashboardShell from "../../../components/layout/DashboardShell";
import RevenueRightDetails from "../../../components/nfts/RevenueRightDetails";

export const instant = false;

async function RightContent({ params }: { params: Promise<{ tokenId: string }> }) {
  await connection();
  const { tokenId: routeTokenId } = await params;
  // This Next.js build supplies the percent-encoded segment. Decode exactly once;
  // malformed/double-encoded IDs still fail the detail component's token grammar.
  let tokenId = routeTokenId;
  try { tokenId = decodeURIComponent(routeTokenId); } catch { /* Render the existing not-found state. */ }
  return <RevenueRightDetails key={tokenId} tokenId={tokenId} />;
}

export default function RightPage({ params }: { params: Promise<{ tokenId: string }> }) {
  return <DashboardShell title="Revenue right" subtitle="Ownership that earns. Inspect the NFT behind a contributor share.">
    <div className="mx-auto max-w-7xl"><Suspense fallback={<p role="status" className="text-sm text-[#A9B6CF]">Opening revenue right...</p>}><RightContent params={params} /></Suspense></div>
  </DashboardShell>;
}
