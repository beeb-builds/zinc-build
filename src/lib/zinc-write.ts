import {
  actionCreators,
  type WalletSelector,
} from "@near-wallet-selector/core";

import { ZINC_CONTRACT_ID } from "./near";
import { nearToYocto } from "near-api-js";
import { recordConfirmedActivity } from "./zinc-activity";
import { reportTransaction, type TransactionObserver } from "./transaction-progress";
import { beginTransactionAttempt, updateTransactionAttempt, type TransactionAttempt } from "./transaction-journal";
import { verifyExecution } from "./verify-transaction";
import { beginBrowserWrite, browserReads } from "./read-scheduler";

const GAS = BigInt("100000000000000");

type SendOptions = Parameters<Awaited<ReturnType<WalletSelector["wallet"]>>["signAndSendTransaction"]>[0];
type AttemptDetails = Omit<TransactionAttempt, "id" | "startedAt" | "state" | "hash" | "reason" | "accountId">;
async function sendTransaction(selector: WalletSelector, options: SendOptions, observer: TransactionObserver | undefined, details: AttemptDetails) {
  reportTransaction(observer, { phase: "preparing" });
  const accountId = selector.store.getState().accounts.find((account) => account.active)?.accountId;
  if (!accountId) throw new Error("Connect your wallet before submitting a transaction.");
  const attempt = beginTransactionAttempt({ ...details, accountId });
  browserReads.invalidate();
  const finishWrite = beginBrowserWrite();
  let verified = false;
  try {
    const wallet = await selector.wallet();
    if (selector.store.getState().accounts.find((account) => account.active)?.accountId !== accountId) throw new Error("Your wallet account changed. Refresh before trying again.");
    reportTransaction(observer, { phase: "wallet" });
    const outcome = await wallet.signAndSendTransaction({ ...options, signerId: accountId });
    reportTransaction(observer, { phase: "verifying", hash: outcome?.transaction.hash });
    if (!outcome) {
      updateTransactionAttempt(attempt.id, { state: "unconfirmed", reason: "The wallet returned without a transaction result. Check wallet activity before retrying." });
      return outcome;
    }
    const result = verifyExecution(outcome, details.method === "claim_revenue");
    updateTransactionAttempt(attempt.id, { ...result, hash: outcome.transaction.hash });
    verified = true;
    if (result.state !== "confirmed") throw new Error(result.state === "failed" ? `The transaction failed on NEAR. ${result.reason}` : result.reason);
    return outcome;
  } catch (error) {
    if (!verified) updateTransactionAttempt(attempt.id, { state: "unconfirmed", reason: "No verified result was received. Check wallet activity before submitting again." });
    throw error;
  } finally {
    finishWrite();
    // Reads started during signing must not survive the result, including failures.
    browserReads.invalidate();
  }
}

export function parseDepositAmount(amountNear: string): bigint {
  const amount = amountNear.trim();
  if (!/^\d+(?:\.\d{1,24})?$/.test(amount)) {
    throw new Error("Enter a valid NEAR decimal with up to 24 decimal places (for example, 0.1).");
  }
  const yocto = nearToYocto(amount as `${number}`);
  if (yocto <= BigInt(0)) {
    throw new Error("Deposit amount must be greater than 0 NEAR.");
  }
  if (yocto > BigInt("340282366920938463463374607431768211455")) {
    throw new Error("Deposit amount exceeds the maximum supported NEAR amount.");
  }
  return yocto;
}

export async function depositRevenueOnNear(
  selector: WalletSelector,
  campaignId: number,
  amountNear: string,
  observer?: TransactionObserver,
) {
  if (!Number.isSafeInteger(campaignId) || campaignId < 0) {
    throw new Error("Invalid campaign ID.");
  }
  const deposit = parseDepositAmount(amountNear);
  const outcome = await sendTransaction(selector, {
    receiverId: ZINC_CONTRACT_ID,
    actions: [
      actionCreators.functionCall(
        "deposit_revenue",
        { campaign_id: campaignId },
        GAS,
        deposit,
      ),
    ],
  }, observer, { method: "deposit_revenue", args: { campaign_id: campaignId }, deposit: deposit.toString(), kind: "Deposits", campaignId, amountYocto: deposit.toString() });

  if (!outcome) {
    throw new Error("Your wallet returned no transaction confirmation. Check your wallet activity before depositing again.");
  }
  const statuses = [
    outcome.status,
    outcome.transaction_outcome.outcome.status,
    ...outcome.receipts_outcome.map((receipt) => receipt.outcome.status),
  ];
  if (statuses.some((status) => typeof status === "object" && "Failure" in status)) {
    throw new Error("The deposit failed on NEAR. Check that the campaign is still active and your wallet has enough NEAR for the deposit and gas.");
  }
  if (typeof outcome.status !== "object" || !("SuccessValue" in outcome.status)) {
    throw new Error("The deposit is not confirmed yet. Check your wallet activity before depositing again.");
  }
  recordConfirmedActivity(outcome, { kind: "Deposits", campaignId, amountYocto: deposit.toString() });
  return outcome;
}

export async function claimRevenueOnNear(
  selector: WalletSelector,
  campaignId: number,
  observer?: TransactionObserver,
) {
  if (!Number.isSafeInteger(campaignId) || campaignId < 0) {
    throw new Error("Invalid campaign ID.");
  }
  const outcome = await sendTransaction(selector, {
    receiverId: ZINC_CONTRACT_ID,
    actions: [
      actionCreators.functionCall(
        "claim_revenue",
        { campaign_id: campaignId },
        GAS,
        BigInt(0),
      ),
    ],
  }, observer, { method: "claim_revenue", args: { campaign_id: campaignId }, deposit: "0", kind: "Claims", campaignId });

  if (!outcome) {
    throw new Error("Your wallet returned no claim confirmation. Check your wallet activity and refresh your balances before trying again.");
  }
  const statuses = [
    outcome.status,
    outcome.transaction_outcome.outcome.status,
    ...outcome.receipts_outcome.map((receipt) => receipt.outcome.status),
  ];
  if (statuses.some((status) => typeof status === "object" && "Failure" in status)) {
    throw new Error("The claim or payout failed on NEAR. Refresh your balances and check your wallet activity before retrying.");
  }
  if (typeof outcome.status !== "object" || !("SuccessValue" in outcome.status)) {
    throw new Error("The claim is not confirmed yet. Check your wallet activity and refresh your balances before trying again.");
  }
  // claim_revenue returns the native payout callback's JSON boolean.
  const encodedResult = outcome.status.SuccessValue;
  if (typeof encodedResult !== "string") {
    throw new Error("The claim is not confirmed yet. Refresh your balances and check your wallet activity.");
  }
  let paid: unknown;
  try {
    paid = JSON.parse(atob(encodedResult));
  } catch {
    throw new Error("NEAR returned an unexpected claim confirmation. Check your wallet activity and refresh your balances.");
  }
  if (paid !== true) {
    throw new Error("The payout was not successful. Refresh your balances; a failed payout restores claimability when its callback completes.");
  }
  recordConfirmedActivity(outcome, { kind: "Claims", campaignId });
  return outcome;
}

export function validateNftReceiver(receiverId: string, ownerId?: string): string {
  const receiver = receiverId.trim();
  if (!receiver) throw new Error("Enter the receiver's NEAR account ID.");
  if (receiver.length < 2 || receiver.length > 64 || !/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/.test(receiver)) {
    throw new Error("Enter a valid NEAR account ID, such as bob.testnet or a 64-character implicit account.");
  }
  if (receiver === ownerId) throw new Error("Choose a receiver different from the current owner.");
  return receiver;
}

export async function transferRevenueRightOnNear(
  selector: WalletSelector,
  tokenId: string,
  receiverId: string,
  expectedOwnerId?: string,
  observer?: TransactionObserver,
) {
  if (!tokenId.trim()) throw new Error("NFT token ID is required.");
  const signerId = selector.store.getState().accounts.find((account) => account.active)?.accountId;
  if (!signerId) throw new Error("Connect a NEAR Testnet wallet to transfer this NFT.");
  if (expectedOwnerId && signerId !== expectedOwnerId) {
    throw new Error("Your connected account changed. Refresh your NFTs before transferring.");
  }
  const receiver = validateNftReceiver(receiverId, signerId);
  const match = /^campaign:(\d+):right:\d+$/.exec(tokenId);
  const campaignId = match ? Number(match[1]) : undefined;
  const outcome = await sendTransaction(selector, {
    signerId,
    receiverId: ZINC_CONTRACT_ID,
    actions: [actionCreators.functionCall(
      "nft_transfer",
      { receiver_id: receiver, token_id: tokenId },
      GAS,
      BigInt(1),
    )],
  }, observer, { method: "nft_transfer", args: { receiver_id: receiver, token_id: tokenId }, deposit: "1", kind: "NFT Transfers", tokenId, to: receiver, campaignId: Number.isSafeInteger(campaignId) ? campaignId : undefined });
  if (!outcome) {
    throw new Error("Your wallet returned no transfer confirmation. Check your wallet activity and refresh ownership before trying again.");
  }
  const statuses = [outcome.status, outcome.transaction_outcome.outcome.status,
    ...outcome.receipts_outcome.map((receipt) => receipt.outcome.status)];
  if (statuses.some((status) => typeof status === "object" && "Failure" in status)) {
    throw new Error("The NFT transfer failed on NEAR. Check that you still own it, the receiver account exists, and your wallet has enough NEAR for gas.");
  }
  if (typeof outcome.status !== "object" || !("SuccessValue" in outcome.status) || typeof outcome.status.SuccessValue !== "string") {
    throw new Error("The NFT transfer is not confirmed yet. Check your wallet activity and refresh ownership before retrying.");
  }
  recordConfirmedActivity(outcome, { kind: "NFT Transfers", tokenId, from: signerId, to: receiver,
    campaignId: Number.isSafeInteger(campaignId) ? campaignId : undefined });
  return outcome;
}

export type CreateCampaignInput = {
  name: string;
  description: string;
  startTimestampMs: number;
  endTimestampMs: number;
  contributors: {
    role: string;
    accountId: string;
    shareBps: number;
  }[];
  treasuryAccount: string;
  treasuryShareBps: number;
};

export async function createCampaignOnNear(
  selector: WalletSelector,
  input: CreateCampaignInput,
  observer?: TransactionObserver,
) {

  const { functionCall } = actionCreators;
  const args = {
    name: input.name,
    description: input.description,
    start_timestamp_ms: input.startTimestampMs,
    end_timestamp_ms: input.endTimestampMs,
    contributors: input.contributors.map((contributor) => ({ role: contributor.role, account_id: contributor.accountId, share_bps: contributor.shareBps })),
    treasury_account: input.treasuryAccount,
    treasury_share_bps: input.treasuryShareBps,
  };

  const outcome = await sendTransaction(selector, {
    receiverId: ZINC_CONTRACT_ID,

    actions: [
      functionCall(
        "create_campaign",
        args,

        GAS,
        BigInt(0),
      ),
    ],
  }, observer, { method: "create_campaign", args, deposit: "0", kind: "Campaigns", campaignName: input.name });
  if (!outcome) throw new Error("No transaction confirmation was returned by your wallet. Check wallet activity before trying again.");
  const statuses = [outcome.status, outcome.transaction_outcome.outcome.status, ...outcome.receipts_outcome.map((receipt) => receipt.outcome.status)];
  if (statuses.some((status) => typeof status === "object" && status !== null && "Failure" in status)) {
    throw new Error("The transaction failed on NEAR. Check wallet activity for details before trying again.");
  }
  if (typeof outcome.status !== "object" || !("SuccessValue" in outcome.status) || typeof outcome.status.SuccessValue !== "string") {
    throw new Error("Campaign creation is not confirmed yet. Check wallet activity before trying again.");
  }
  // Campaign creation itself is listed from contract state; retain its confirmed hash too.
  let campaignId: number | undefined;
  try {
    if (outcome && typeof outcome.status === "object" && "SuccessValue" in outcome.status && typeof outcome.status.SuccessValue === "string") {
      const result: unknown = JSON.parse(atob(outcome.status.SuccessValue));
      if (result && typeof result === "object" && "id" in result && typeof result.id === "number" && Number.isSafeInteger(result.id)) campaignId = result.id;
    }
  } catch { /* A transaction link is still useful if the return value is unavailable. */ }
  recordConfirmedActivity(outcome, { kind: "Campaigns", campaignId, campaignName: input.name });
  return outcome;
}
