"use client";

import type { CampaignStatus } from "../../lib/campaign-discovery";
import { useCampaignStatus } from "./useCampaignStatus";

export default function CampaignStatusBadge({ startTimestampMs, endTimestampMs, initialStatus }: {
  startTimestampMs: number; endTimestampMs: number; initialStatus: CampaignStatus;
}) {
  const { status } = useCampaignStatus(startTimestampMs, endTimestampMs, initialStatus);
  return <span role="status" aria-label={`Campaign status: ${status}`} className="rounded-full border border-[#FF8E9C]/25 bg-[#FF8E9C]/10 px-3 py-1 text-xs font-semibold text-[#FF8E9C]">{status}</span>;
}
