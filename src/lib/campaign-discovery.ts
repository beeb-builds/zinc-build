import type { OnChainCampaign } from "./zinc-contract";

export type CampaignStatus = "Scheduled" | "Active" | "Ended";
export type CampaignSort = "Newest" | "Revenue" | "Ending soon";
export type CampaignRelationship = "All" | "Created by me" | "Original contributor";
export function campaignStatus(campaign: Pick<OnChainCampaign, "start_timestamp_ms" | "end_timestamp_ms">, now: number): CampaignStatus {
  return now < campaign.start_timestamp_ms ? "Scheduled" : now > campaign.end_timestamp_ms ? "Ended" : "Active";
}
export function validateDiscoveryCampaigns(campaigns: OnChainCampaign[]) {
  if (!Array.isArray(campaigns) || new Set(campaigns.map((campaign) => campaign.id)).size !== campaigns.length || campaigns.some((campaign) =>
    !Number.isSafeInteger(campaign.id) || campaign.id < 0 || typeof campaign.name !== "string" || typeof campaign.description !== "string" || typeof campaign.creator !== "string" ||
    typeof campaign.total_deposited_yocto !== "string" || !/^\d+$/.test(campaign.total_deposited_yocto) ||
    [campaign.created_at_ms, campaign.start_timestamp_ms, campaign.end_timestamp_ms].some((value) => !Number.isSafeInteger(value) || value < 0 || value > 8640000000000000) || campaign.end_timestamp_ms < campaign.start_timestamp_ms ||
    !Array.isArray(campaign.contributors) || campaign.contributors.some((contributor) => typeof contributor.role !== "string" || typeof contributor.account_id !== "string" || !Number.isInteger(contributor.share_bps) || contributor.share_bps < 0 || contributor.share_bps > 10000) ||
    !Number.isInteger(campaign.treasury_share_bps) || campaign.treasury_share_bps < 0 || campaign.treasury_share_bps > 10000)) throw new Error("Campaign data is incomplete or invalid. Refresh campaigns to retry.");
}
export function campaignDiscoveryTotals(campaigns: OnChainCampaign[], now: number) {
  validateDiscoveryCampaigns(campaigns);
  return { count: campaigns.length, active: campaigns.filter((campaign) => campaignStatus(campaign, now) === "Active").length,
    revenueYocto: campaigns.reduce((sum, campaign) => sum + BigInt(campaign.total_deposited_yocto), BigInt(0)) };
}
export function discoverCampaigns(campaigns: OnChainCampaign[], options: { query: string; status: "All" | CampaignStatus; sort: CampaignSort; relationship: CampaignRelationship; accountId: string | null; now: number }) {
  const query = options.query.trim().toLowerCase();
  const exactId = /^#(\d+)$/.exec(query)?.[1].replace(/^0+(?=\d)/, "");
  const selected = campaigns.filter((campaign) => {
    if (options.status !== "All" && campaignStatus(campaign, options.now) !== options.status) return false;
    if (options.relationship !== "All" && (!options.accountId || (options.relationship === "Created by me" ? campaign.creator !== options.accountId : !campaign.contributors.some((contributor) => contributor.account_id === options.accountId)))) return false;
    return exactId !== undefined ? String(campaign.id) === exactId : !query || [String(campaign.id), campaign.name, campaign.description, campaign.creator, ...campaign.contributors.flatMap((contributor) => [contributor.role, contributor.account_id])].some((value) => value.toLowerCase().includes(query));
  });
  const newest = (a: OnChainCampaign, b: OnChainCampaign) => b.created_at_ms - a.created_at_ms || b.id - a.id;
  return selected.sort((a, b) => {
    if (options.sort === "Revenue") {
      const first = BigInt(a.total_deposited_yocto), second = BigInt(b.total_deposited_yocto);
      return first === second ? newest(a, b) : first > second ? -1 : 1;
    }
    if (options.sort === "Ending soon") {
      const ranks = { Active: 0, Scheduled: 1, Ended: 2 };
      const first = campaignStatus(a, options.now), second = campaignStatus(b, options.now);
      return ranks[first] - ranks[second] || (first === "Ended" ? b.end_timestamp_ms - a.end_timestamp_ms : a.end_timestamp_ms - b.end_timestamp_ms) || newest(a, b);
    }
    return newest(a, b);
  });
}
