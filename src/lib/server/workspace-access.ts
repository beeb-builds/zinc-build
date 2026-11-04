import "server-only";
import { JsonRpcProvider } from "near-api-js";
import { verifyMessage } from "near-api-js/nep413";
import { NEAR_RPC_URL, ZINC_CONTRACT_ID } from "../near";
import type { OnChainCampaign, OnChainRevenueRight } from "../zinc-contract";
import { WorkspaceError, type Challenge } from "./workspace-store";

const provider = new JsonRpcProvider({ url: NEAR_RPC_URL });
export const workspaceRecipient = (origin: string) => `Zinc workspace | ${origin} | ${ZINC_CONTRACT_ID} | testnet`;
export async function verifyWorkspaceSignature(challenge: Challenge, publicKey: string, signature: string) {
  if (!/^ed25519:[1-9A-HJ-NP-Za-km-z]+$/.test(publicKey) || !/^[A-Za-z0-9+/]{86}==$/.test(signature)) throw new WorkspaceError(401, "The wallet did not return a supported NEP-413 signature.");
  try {
    await verifyMessage({ signerAccountId: challenge.account, signerPublicKey: publicKey, signature: Buffer.from(signature, "base64"), provider,
      payload: { message: challenge.message, nonce: Buffer.from(challenge.nonce, "base64"), recipient: workspaceRecipient(challenge.origin) } });
  } catch { throw new WorkspaceError(401, "Could not verify this signature and its full-access key on NEAR. Request a new signature."); }
}
export async function requireActiveKey(accountId: string, publicKey: string) {
  try {
    const key = await provider.viewAccessKey({ accountId, publicKey, finalityQuery: { finality: "final" } });
    if (key.permission !== "FullAccess") throw new Error("Key revoked");
  } catch { throw new WorkspaceError(401, "Your signing key could not be verified. Sign in again after checking the wallet connection."); }
}
export async function authorizeWorkspace(campaignId: number, accountId: string) {
  const [campaign, rights] = await Promise.all([
    provider.callFunction<OnChainCampaign>({ contractId: ZINC_CONTRACT_ID, method: "get_campaign", args: { campaign_id: campaignId }, blockQuery: { finality: "final" } }),
    provider.callFunction<OnChainRevenueRight[]>({ contractId: ZINC_CONTRACT_ID, method: "get_campaign_rights", args: { campaign_id: campaignId }, blockQuery: { finality: "final" } }).catch(() => null),
  ]);
  if (!campaign) throw new WorkspaceError(404, "Campaign not found.");
  const creator = campaign.creator === accountId;
  if (!creator && (!Array.isArray(rights) || !rights.some((right) => right.campaign_id === campaignId && right.owner_id === accountId))) throw new WorkspaceError(403, "Access requires a currently owned campaign NFT. Former ownership and treasury shares do not grant access.");
  return { campaignName: campaign.name, canEdit: creator, accountId };
}
