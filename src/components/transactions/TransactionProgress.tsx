"use client";

import { useRef, useState } from "react";
import type { TransactionObserver, TransactionUpdate } from "../../lib/transaction-progress";

export type TransactionProgressState = {
  phase: TransactionUpdate["phase"] | "confirmed" | "rejected" | "failed" | "unconfirmed" | "not-submitted";
  hash?: string;
};

export function useTransactionProgress() {
  const [progress, setProgress] = useState<TransactionProgressState | null>(null);
  const locked = useRef(false);
  async function run<T>(action: (report: TransactionObserver) => Promise<T>): Promise<T> {
    if (locked.current) throw new Error("A transaction is already in progress.");
    locked.current = true;
    setProgress({ phase: "preparing" });
    try {
      const result = await action((update) => setProgress((current) => ({ ...current, ...update })));
      setProgress((current) => ({ ...current, phase: "confirmed" }));
      return result;
    } catch (error) {
      const message = typeof error === "string" ? error : error && typeof error === "object" && "message" in error && typeof error.message === "string" ? error.message : "";
      const notSubmitted = error && typeof error === "object" && "code" in error && error.code === "ZINC_WALLET_NOT_SUBMITTED";
      const phase = notSubmitted ? "not-submitted" : /reject|cancel|denied|declin/i.test(message) ? "rejected"
        : /failed on NEAR|transaction failed on NEAR|payout was not successful/i.test(message) ? "failed" : "unconfirmed";
      setProgress((current) => ({ ...current, phase }));
      throw error;
    } finally { locked.current = false; }
  }
  return { progress, run };
}

const messages: Record<TransactionProgressState["phase"], [string, string]> = {
  preparing: ["Preparing transaction", "Checking the request before opening your wallet."],
  wallet: ["Waiting for wallet / network", "Approve in your wallet, then wait for its NEAR result. Some wallets keep this step open until execution finishes."],
  verifying: ["Verifying transaction receipts", "Checking contract execution and any payout callback returned by your wallet."],
  confirmed: ["Confirmed on NEAR", "The transaction completed successfully. Displayed balances or ownership may still be refreshing."],
  rejected: ["Wallet request rejected", "No success was confirmed. Check wallet activity if you already approved the transaction."],
  failed: ["Transaction did not complete successfully", "Check the transaction details and refresh balances or ownership before retrying."],
  unconfirmed: ["Confirmation unavailable", "A successful result was not received. Check wallet activity and refresh the page data before submitting again."],
  "not-submitted": ["Not submitted · reconnect wallet", "The session check stopped this request before signing. Reconnect the intended wallet, then review your request again. No transaction was retried."],
};

export default function TransactionProgress({ progress }: { progress: TransactionProgressState | null }) {
  if (!progress) return null;
  const [title, description] = messages[progress.phase];
  const complete = progress.phase === "confirmed";
  return <div role="status" aria-live="polite" aria-atomic="true" className={`rounded-xl border p-4 ${complete ? "border-[#69dab8]/25 bg-[#153c39]/40" : "border-[#293954] bg-[#0B1933]"}`}>
    <p className={`text-sm font-semibold ${complete ? "text-[#69dab8]" : "text-[#FF8E9C]"}`}>{title}</p>
    <p className="mt-2 text-xs leading-5 text-[#A9B6CF]">{description}</p>
    {progress.hash && <a href={`https://testnet.nearblocks.io/txns/${encodeURIComponent(progress.hash)}`} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex text-sm text-[#FF8E9C]">View transaction on explorer ↗</a>}
  </div>;
}
