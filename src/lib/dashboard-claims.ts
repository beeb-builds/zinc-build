import type { OnChainCampaign } from "./zinc-contract";

export type DashboardClaim = { campaignId: number; campaignName: string; amountYocto: string };

/** All campaign responses are required, including ended campaigns and former-owner earnings. */
export function summarizeDashboardClaims(campaigns: OnChainCampaign[], amounts: string[]): { amount: bigint; ready: DashboardClaim[] } {
  if (campaigns.length !== amounts.length || new Set(campaigns.map((campaign) => campaign.id)).size !== campaigns.length) throw new Error("Incomplete campaign claim responses.");
  let amount = BigInt(0);
  const ready: DashboardClaim[] = [];
  for (const [index, campaign] of campaigns.entries()) {
    const value = amounts[index];
    if (typeof value !== "string" || !/^\d+$/.test(value)) throw new Error("Invalid claimable amount.");
    const claimable = BigInt(value);
    amount += claimable;
    if (claimable > BigInt(0)) ready.push({ campaignId: campaign.id, campaignName: campaign.name, amountYocto: claimable.toString() });
  }
  ready.sort((a, b) => BigInt(a.amountYocto) === BigInt(b.amountYocto) ? b.campaignId - a.campaignId : BigInt(a.amountYocto) > BigInt(b.amountYocto) ? -1 : 1);
  return { amount, ready };
}
