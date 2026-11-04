import { getAllNftTokensForOwner, type OnChainCampaign, type OnChainNftToken } from "./zinc-contract";
import { readEarningsBalances, type EarningsBalance } from "./wallet-earnings";

export type WalletCampaign = { campaign: OnChainCampaign; creator: boolean; treasury: boolean; originalContributor: boolean; currentRights: number; claimable: bigint | null; claimed: bigint | null };
export type WalletDashboard = { accountId: string; claimable: bigint | null; claimed: bigint | null; ownedCount: number | null; relatedCount: number | null; rows: WalletCampaign[]; warnings: string[] };

export function summarizeWalletDashboard(campaigns: OnChainCampaign[], accountId: string, balances: EarningsBalance[] | null, tokens: OnChainNftToken[] | null): WalletDashboard {
  const byId = new Map(campaigns.map((campaign) => [campaign.id, campaign]));
  const owned = new Map<number, number>();
  if (tokens) {
    const seen = new Set<string>();
    for (const token of tokens) {
      const match = /^campaign:(0|[1-9]\d*):right:(0|[1-9]\d*)$/.exec(token.token_id);
      const campaign = match ? byId.get(Number(match[1])) : undefined;
      if (token.owner_id !== accountId || seen.has(token.token_id) || !match || !campaign || !campaign.contributors[Number(match[2])]) throw new Error("NFT ownership changed or returned incomplete data. Refresh to retry.");
      seen.add(token.token_id);
      owned.set(campaign.id, (owned.get(campaign.id) ?? 0) + 1);
    }
  }
  const balanceById = new Map(balances?.map((balance) => [balance.campaign.id, balance]));
  if (balances && (balanceById.size !== campaigns.length || balances.length !== campaigns.length || campaigns.some((campaign) => !balanceById.has(campaign.id)))) throw new Error("Incomplete wallet balance snapshot.");
  const rows = campaigns.map((campaign) => {
    const balance = balanceById.get(campaign.id);
    return { campaign, creator: campaign.creator === accountId, treasury: campaign.treasury_account === accountId && campaign.treasury_share_bps > 0,
      originalContributor: campaign.contributors.some((contributor) => contributor.account_id === accountId), currentRights: owned.get(campaign.id) ?? 0,
      claimable: balance?.claimable ?? null, claimed: balance?.claimed ?? null };
  }).filter((row) => row.creator || row.treasury || row.originalContributor || row.currentRights > 0 || (row.claimable ?? BigInt(0)) > BigInt(0) || (row.claimed ?? BigInt(0)) > BigInt(0))
    .sort((a, b) => b.campaign.created_at_ms - a.campaign.created_at_ms || b.campaign.id - a.campaign.id);
  return { accountId, claimable: balances?.reduce((sum, row) => sum + row.claimable, BigInt(0)) ?? null, claimed: balances?.reduce((sum, row) => sum + row.claimed, BigInt(0)) ?? null,
    ownedCount: tokens?.length ?? null, relatedCount: balances && tokens ? rows.length : null, rows,
    warnings: [...(!balances ? ["Wallet balances could not be loaded. Unavailable amounts are not zero."] : []), ...(!tokens ? ["Current NFT ownership could not be loaded. Your revenue balances remain independent of ownership."] : [])] };
}

export async function readWalletDashboard(campaigns: OnChainCampaign[], accountId: string): Promise<WalletDashboard> {
  const [balances, tokens] = await Promise.allSettled([readEarningsBalances(campaigns, accountId), getAllNftTokensForOwner(accountId)]);
  const completeBalances = balances.status === "fulfilled" ? balances.value : null;
  const ownedTokens = tokens.status === "fulfilled" ? tokens.value : null;
  try { return summarizeWalletDashboard(campaigns, accountId, completeBalances, ownedTokens); }
  catch {
    // A malformed ownership response must not hide valid historical earnings.
    return summarizeWalletDashboard(campaigns, accountId, completeBalances, null);
  }
}
