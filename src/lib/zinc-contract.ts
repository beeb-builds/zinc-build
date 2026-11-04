import { JsonRpcProvider, type SerializedReturnValue } from "near-api-js";
import { browserReads } from "./read-scheduler";
import {
  NEAR_RPC_URL,
  NEAR_NETWORK_ID,
  ZINC_CONTRACT_ID,
} from "./near";

export type OnChainContributor = {
  role: string;
  account_id: string;
  share_bps: number;
};

export type OnChainCampaign = {
  id: number;
  creator: string;
  name: string;
  description: string;
  start_timestamp_ms: number;
  end_timestamp_ms: number;
  contributors: OnChainContributor[];
  treasury_account: string;
  treasury_share_bps: number;
  created_at_ms: number;
  total_deposited_yocto: string;
};

export type OnChainRevenueRight = {
  token_id: string;
  owner_id: string;
  campaign_id: number;
  contributor_index: number;
  role: string;
  share_bps: number;
};

export type OnChainNftToken = {
  token_id: string;
  owner_id: string;
  metadata: {
    title?: string | null;
    description?: string | null;
    media?: string | null;
    extra?: string | null;
  } | null;
  approved_account_ids: Record<string, number> | null;
};

const rpc = new JsonRpcProvider({
  url: NEAR_RPC_URL,
});

const provider = {
  callFunction<T extends SerializedReturnValue>(request: { contractId: string; method: string; args: Record<string, unknown> }, fresh = false) {
    const read = async () => {
      const value = await rpc.callFunction<T>(request);
      if (value === undefined) throw new Error("NEAR did not return a contract response.");
      if (["get_campaigns", "get_campaign_rights", "nft_tokens_for_owner"].includes(request.method) && !Array.isArray(value)) throw new Error("NEAR returned an invalid list.");
      if (["get_claimable", "get_claimed", "nft_total_supply"].includes(request.method) && (typeof value !== "string" || !/^\d+$/.test(value))) throw new Error("NEAR returned an invalid amount.");
      return value;
    };
    // Never share requests across server render/request lifetimes.
    return typeof window === "undefined" ? read() : browserReads.schedule(JSON.stringify({ network: NEAR_NETWORK_ID, rpc: NEAR_RPC_URL, ...request }), read, fresh);
  },
};

export async function getCampaignCount(): Promise<number> {
  const count = await provider.callFunction<number>({
    contractId: ZINC_CONTRACT_ID,
    method: "get_campaign_count",
    args: {},
  });

  if (count === undefined) {
    throw new Error("NEAR did not return a campaign count.");
  }

  return count;
}

export async function getCampaigns(): Promise<OnChainCampaign[]> {
  const campaigns = await provider.callFunction<OnChainCampaign[]>({
    contractId: ZINC_CONTRACT_ID,
    method: "get_campaigns",
    args: {},
  });
  if (!Array.isArray(campaigns)) throw new Error("NEAR did not return campaigns.");
  return campaigns;
}

export async function getNftTotalSupply(): Promise<string> {
  const supply = await provider.callFunction<string>({
    contractId: ZINC_CONTRACT_ID,
    method: "nft_total_supply",
    args: {},
  });
  if (typeof supply !== "string" || !/^\d+$/.test(supply)) throw new Error("NEAR did not return the NFT supply.");
  return supply;
}

export async function getCampaign(
  campaignId: number,
): Promise<OnChainCampaign | null> {
  const campaign = await provider.callFunction<OnChainCampaign>({
    contractId: ZINC_CONTRACT_ID,
    method: "get_campaign",
    args: {
      campaign_id: campaignId,
    },
  });

  return campaign ?? null;
}

// U128 view results are decimal strings; never coerce them to JS numbers.
export async function getClaimable(campaignId: number, accountId: string): Promise<string> {
  const amount = await provider.callFunction<string>({
    contractId: ZINC_CONTRACT_ID,
    method: "get_claimable",
    args: { campaign_id: campaignId, account_id: accountId },
  });
  if (amount === undefined) throw new Error("NEAR did not return a claimable amount.");
  return amount;
}

export async function getClaimed(campaignId: number, accountId: string): Promise<string> {
  const amount = await provider.callFunction<string>({
    contractId: ZINC_CONTRACT_ID,
    method: "get_claimed",
    args: { campaign_id: campaignId, account_id: accountId },
  });
  if (amount === undefined) throw new Error("NEAR did not return a claimed amount.");
  return amount;
}

export async function getNftToken(tokenId: string, fresh = false): Promise<OnChainNftToken | null> {
  return await provider.callFunction<OnChainNftToken>({
    contractId: ZINC_CONTRACT_ID,
    method: "nft_token",
    args: { token_id: tokenId },
  }, fresh) ?? null;
}

export async function getRevenueRight(tokenId: string): Promise<OnChainRevenueRight | null> {
  return await provider.callFunction<OnChainRevenueRight>({
    contractId: ZINC_CONTRACT_ID,
    method: "get_revenue_right",
    args: { token_id: tokenId },
  }) ?? null;
}

export async function getCampaignRights(campaignId: number): Promise<OnChainRevenueRight[]> {
  const rights = await provider.callFunction<OnChainRevenueRight[]>({
    contractId: ZINC_CONTRACT_ID,
    method: "get_campaign_rights",
    args: { campaign_id: campaignId },
  });
  if (rights === undefined) throw new Error("NEAR did not return campaign revenue rights.");
  return rights;
}

export async function getNftTokensForOwner(accountId: string, fromIndex = "0", limit = 50): Promise<OnChainNftToken[]> {
  const tokens = await provider.callFunction<OnChainNftToken[]>({
    contractId: ZINC_CONTRACT_ID,
    method: "nft_tokens_for_owner",
    args: { account_id: accountId, from_index: fromIndex, limit },
  });
  if (tokens === undefined) throw new Error("NEAR did not return owned revenue-right NFTs.");
  return tokens;
}

export async function getAllNftTokensForOwner(accountId: string): Promise<OnChainNftToken[]> {
  const tokens: OnChainNftToken[] = [];
  const seen = new Set<string>();
  const pageSize = 50;
  let offset = BigInt(0);
  while (true) {
    const page = await getNftTokensForOwner(accountId, offset.toString(), pageSize);
    for (const token of page) {
      if (seen.has(token.token_id)) {
        throw new Error("NFT ownership changed while loading. Refresh your NFTs to try again.");
      }
      seen.add(token.token_id);
      tokens.push(token);
    }
    if (page.length < pageSize) return tokens;
    offset += BigInt(page.length);
  }
}
