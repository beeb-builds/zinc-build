import { getAllNftTokensForOwner, getCampaignRights, getClaimable, getClaimed, type OnChainCampaign, type OnChainRevenueRight } from "./zinc-contract";

export type EarningsBalance = { campaign: OnChainCampaign; claimable: bigint; claimed: bigint; originalShares: { role: string; share_bps: number }[]; treasury: boolean };
export type EarningsOwnership = { rights: Map<number, OnChainRevenueRight[] | null>; ownedCount: number | null; warnings: string[] };
export type EarningsRow = EarningsBalance & { currentRights: OnChainRevenueRight[] | null; previousRights: boolean; retainedRevenue: boolean };
export type EarningsFilter = "All" | "Claimable" | "Current rights" | "Previously held" | "Treasury";

function amount(value: string) { if (typeof value !== "string" || !/^\d+$/.test(value)) throw new Error("Invalid earnings amount returned by NEAR."); return BigInt(value); }
export function validateEarningsCampaigns(campaigns: OnChainCampaign[]) {
  if (!Array.isArray(campaigns) || new Set(campaigns.map((campaign) => campaign.id)).size !== campaigns.length || campaigns.some((campaign) => !Number.isSafeInteger(campaign.id) || campaign.id < 0)) throw new Error("Campaign data is incomplete or duplicated. Refresh earnings to retry.");
}

/** A complete balance snapshot succeeds or fails as a unit; ownership cannot suppress it. */
export async function readEarningsBalances(campaigns: OnChainCampaign[], accountId: string): Promise<EarningsBalance[]> {
  validateEarningsCampaigns(campaigns);
  return Promise.all(campaigns.map(async (campaign) => {
    const [claimable, claimed] = await Promise.all([getClaimable(campaign.id, accountId), getClaimed(campaign.id, accountId)]);
    return { campaign, claimable: amount(claimable), claimed: amount(claimed), originalShares: campaign.contributors.filter((contributor) => contributor.account_id === accountId), treasury: campaign.treasury_account === accountId && campaign.treasury_share_bps > 0 };
  }));
}

export async function readEarningsOwnership(campaigns: OnChainCampaign[], accountId: string): Promise<EarningsOwnership> {
  validateEarningsCampaigns(campaigns);
  const [tokensResult, ...groups] = await Promise.allSettled([getAllNftTokensForOwner(accountId), ...campaigns.map((campaign) => getCampaignRights(campaign.id))]);
  const rights = new Map<number, OnChainRevenueRight[] | null>();
  const warnings: string[] = [];
  // Keep the two result types separate rather than treating token metadata as revenue rights.
  const tokens = tokensResult.status === "fulfilled" ? tokensResult.value : null;
  for (const [index, campaign] of campaigns.entries()) {
    const result = groups[index];
    const values = result.status === "fulfilled" ? result.value as OnChainRevenueRight[] : null;
    const valid = values && Array.isArray(values) && values.length === campaign.contributors.length &&
      new Set(values.map((right) => right.contributor_index)).size === values.length && values.every((right) => {
        const original = campaign.contributors[right.contributor_index];
        return original && right.campaign_id === campaign.id && right.token_id === `campaign:${campaign.id}:right:${right.contributor_index}` &&
          right.share_bps === original.share_bps && right.role === original.role && Boolean(right.owner_id);
      });
    rights.set(campaign.id, valid ? values!.filter((right) => right.owner_id === accountId) : null);
  }
  const validTokens = tokens && Array.isArray(tokens) && new Set(tokens.map((token) => token.token_id)).size === tokens.length && tokens.every((token) => token.owner_id === accountId);
  let ownedCount = validTokens ? tokens.length : null;
  if (!validTokens) warnings.push("The owned-NFT count is unavailable. Campaign balances are still independent of this read.");
  if ([...rights.values()].some((value) => value === null)) warnings.push("Some campaign ownership details are unavailable. They are labelled unknown rather than transferred.");
  else if (validTokens) {
    const ids = new Set([...rights.values()].flatMap((value) => value!.map((right) => right.token_id)));
    if (ids.size !== tokens.length || tokens.some((token) => !ids.has(token.token_id))) {
      ownedCount = null;
      campaigns.forEach((campaign) => rights.set(campaign.id, null));
      warnings.push("Ownership changed while loading. Refresh earnings for a consistent ownership snapshot; complete revenue balances remain visible.");
    }
  }
  return { rights, ownedCount, warnings };
}

export function relatedEarningsRows(balances: EarningsBalance[], ownership: EarningsOwnership | null, heldTokens: Set<string>, accountId: string): EarningsRow[] {
  return balances.map((row) => {
    const currentRights = ownership?.rights.get(row.campaign.id) ?? null;
    const observed = [...heldTokens].filter((token) => token.startsWith(`campaign:${row.campaign.id}:right:`));
    const previousRights = currentRights !== null && (row.campaign.contributors.some((contributor, index) => contributor.account_id === accountId && !currentRights.some((right) => right.contributor_index === index)) || observed.some((token) => !currentRights.some((right) => right.token_id === token)));
    const retainedRevenue = currentRights !== null && currentRights.length === 0 && !row.treasury && (row.claimable > BigInt(0) || row.claimed > BigInt(0));
    return { ...row, currentRights, previousRights, retainedRevenue, observed: observed.length > 0 };
  }).filter((row) => row.claimable > BigInt(0) || row.claimed > BigInt(0) || (row.currentRights?.length ?? 0) > 0 || row.originalShares.length > 0 || row.treasury || row.observed)
    .sort((a, b) => a.claimable !== b.claimable ? a.claimable > b.claimable ? -1 : 1 : b.campaign.created_at_ms - a.campaign.created_at_ms || b.campaign.id - a.campaign.id);
}

export function filterEarningsRows(rows: EarningsRow[], filter: EarningsFilter): EarningsRow[] {
  return rows.filter((row) => filter === "All" || (filter === "Claimable" && row.claimable > BigInt(0)) ||
    (filter === "Current rights" && (row.currentRights?.length ?? 0) > 0) || (filter === "Previously held" && (row.previousRights || row.retainedRevenue)) || (filter === "Treasury" && row.treasury));
}
