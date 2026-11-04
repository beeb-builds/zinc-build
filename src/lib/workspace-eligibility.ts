import type { OnChainCampaign, OnChainRevenueRight } from "./zinc-contract";

export type WorkspaceEligibility = { campaignName: string; role: "creator" | "holder" | "ineligible" | "unknown"; ownedRights: number | null; originalContributor: boolean; treasury: boolean };

/** Public chain-data preview only. This cannot authenticate a wallet or grant private access. */
export function workspaceEligibility(campaign: OnChainCampaign, rights: OnChainRevenueRight[] | null, accountId: string): WorkspaceEligibility {
  const complete = Array.isArray(rights) && rights.length === campaign.contributors.length && new Set(rights.map((right) => right.contributor_index)).size === rights.length && rights.every((right) => {
    const contributor = campaign.contributors[right.contributor_index];
    return contributor && right.campaign_id === campaign.id && right.token_id === `campaign:${campaign.id}:right:${right.contributor_index}` &&
      right.role === contributor.role && right.share_bps === contributor.share_bps && Boolean(right.owner_id);
  });
  const ownedRights = complete ? rights!.filter((right) => right.owner_id === accountId).length : null;
  return { campaignName: campaign.name, role: campaign.creator === accountId ? "creator" : ownedRights === null ? "unknown" : ownedRights > 0 ? "holder" : "ineligible",
    ownedRights, originalContributor: campaign.contributors.some((contributor) => contributor.account_id === accountId), treasury: campaign.treasury_account === accountId };
}
