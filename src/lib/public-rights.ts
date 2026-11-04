import { getCampaigns, getCampaignRights, type OnChainCampaign, type OnChainRevenueRight } from "./zinc-contract";
import { validateDiscoveryCampaigns } from "./campaign-discovery";

export type PublicRight = { campaign: OnChainCampaign; right: OnChainRevenueRight; originalContributor: string };
export function validateCampaignRights(campaign: OnChainCampaign, rights: OnChainRevenueRight[]): OnChainRevenueRight[] {
  if (!Array.isArray(rights) || rights.length !== campaign.contributors.length || new Set(rights.map((right) => right.contributor_index)).size !== rights.length || rights.some((right) => {
    const original = campaign.contributors[right.contributor_index];
    return !Number.isSafeInteger(right.contributor_index) || right.contributor_index < 0 || !original || right.campaign_id !== campaign.id ||
      right.token_id !== `campaign:${campaign.id}:right:${right.contributor_index}` || right.role !== original.role || right.share_bps !== original.share_bps || typeof right.owner_id !== "string" || !right.owner_id;
  })) throw new Error("Complete, matching revenue-right ownership could not be loaded.");
  return [...rights].sort((a, b) => a.contributor_index - b.contributor_index);
}

export async function readPublicRights() {
  const campaigns = await getCampaigns();
  validateDiscoveryCampaigns(campaigns);
  const ordered = [...campaigns].sort((a, b) => b.created_at_ms - a.created_at_ms || b.id - a.id);
  const results = await Promise.allSettled(ordered.map(async (campaign) => ({ campaign, rights: validateCampaignRights(campaign, await getCampaignRights(campaign.id)) })));
  const rights: PublicRight[] = [], unavailable: number[] = [];
  results.forEach((result, index) => {
    if (result.status === "rejected") { unavailable.push(ordered[index].id); return; }
    const { campaign, rights: items } = result.value;
    items.forEach((right) => rights.push({ campaign, right, originalContributor: campaign.contributors[right.contributor_index].account_id }));
  });
  return { rights, unavailable, campaignCount: campaigns.length };
}

export function filterPublicRights(rights: PublicRight[], query: string, campaignId: string) {
  const search = query.trim().toLowerCase();
  return rights.filter(({ campaign, right, originalContributor }) => (campaignId === "all" || String(campaign.id) === campaignId) && (!search || [campaign.name, String(campaign.id), right.token_id, right.role, right.owner_id, originalContributor].some((value) => value.toLowerCase().includes(search))));
}
