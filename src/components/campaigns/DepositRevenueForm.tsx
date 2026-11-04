"use client";

import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "../wallet/WalletProvider";
import { depositRevenueOnNear, parseDepositAmount } from "../../lib/zinc-write";
import TransactionProgress, { useTransactionProgress } from "../transactions/TransactionProgress";
import DepositReview, { type ReviewedDeposit } from "./DepositReview";
import DepositReceipt, { type ConfirmedDeposit } from "./DepositReceipt";
import { successfulDepositAmount } from "../../lib/deposit-receipt";
import { validTransactionHash } from "../../lib/transaction-journal";
import { useCampaignStatus } from "./useCampaignStatus";

type DepositRevenueFormProps = {
  campaignId: number;
  startTimestampMs: number;
  endTimestampMs: number;
  initiallyActive: boolean;
  purpose?: "deposit" | "support";
};

export default function DepositRevenueForm({
  campaignId,
  startTimestampMs,
  endTimestampMs,
  initiallyActive,
  purpose = "deposit",
}: DepositRevenueFormProps) {
  const router = useRouter();
  const transaction = useTransactionProgress();
  const { selector, accountId, connect } = useWallet();
  const [amount, setAmount] = useState("");
  const { status, recheck } = useCampaignStatus(startTimestampMs, endTimestampMs, initiallyActive ? "Active" : "Scheduled");
  const isActive = status === "Active";
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefreshing, startRefresh] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [review, setReview] = useState<ReviewedDeposit | null>(null);
  const [receipt, setReceipt] = useState<ConfirmedDeposit | null>(null);
  const submissionLocked = useRef(false);
  const busy = isSubmitting || isRefreshing;
  const support = purpose === "support";

  // eslint-disable-next-line react-hooks/set-state-in-effect -- Revoke the prior wallet/campaign's unsigned review and receipt when identity changes.
  useEffect(() => { setReview(null); setReceipt(null); setError(null); }, [accountId, campaignId]);

  let amountError: string | null = null;
  try {
    parseDepositAmount(amount);
  } catch (error) {
    amountError = error instanceof Error ? error.message : "Enter a valid NEAR amount.";
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submissionLocked.current || busy) return;
    setError(null);
    setReceipt(null);
    if (!selector || !accountId) {
      setError(support ? "Connect a NEAR Testnet wallet to support this campaign." : "Connect a NEAR Testnet wallet to deposit revenue.");
      return;
    }
    if (selector.store.getState().accounts.find((account) => account.active)?.accountId !== accountId) {
      setError("Your connected wallet changed. Wait for the account display to update before paying.");
      return;
    }
    const now = Date.now();
    if (now < startTimestampMs || now > endTimestampMs) {
      recheck();
      setError("Revenue deposits are only available while this campaign is Active.");
      return;
    }
    if (amountError) {
      setError(amountError);
      return;
    }

    setReview({ accountId, amountYocto: parseDepositAmount(amount).toString() });
  }

  async function confirmDeposit() {
    if (submissionLocked.current || busy || !review || !selector) return;
    setError(null);
    if (accountId !== review.accountId || selector.store.getState().accounts.find((account) => account.active)?.accountId !== review.accountId) {
      setReview(null); setError("Your wallet changed. Review the payment again with your current account."); return;
    }
    const now = Date.now();
    if (now < startTimestampMs || now > endTimestampMs) {
      recheck(); setReview(null); setError("The campaign is no longer Active. No payment was submitted."); return;
    }
    let amountYocto: string;
    try { amountYocto = parseDepositAmount(amount).toString(); }
    catch { setReview(null); setError("Review a valid amount before confirming."); return; }
    if (amountYocto !== review.amountYocto) { setReview(null); setError("The amount changed. Review the updated payment before signing."); return; }
    submissionLocked.current = true;
    setIsSubmitting(true);
    try {
      const outcome = await transaction.run((report) => depositRevenueOnNear(selector, campaignId, amount, report));
      setReceipt({ campaignId, accountId: outcome.transaction.signer_id, hash: validTransactionHash(outcome.transaction.hash) ? outcome.transaction.hash : null,
        amountYocto: successfulDepositAmount(outcome, campaignId, review.accountId, review.amountYocto) });
      setReview(null);
      setAmount("");
      startRefresh(() => router.refresh());
    } catch (error) {
      const message = error instanceof Error ? error.message
        : typeof error === "string" ? error
        : "Your wallet could not complete the deposit. Check your wallet activity before trying again.";
      setError(/reject|cancel|denied|declin/i.test(message)
        ? "Transaction cancelled or rejected in your wallet. No deposit was confirmed."
        : message);
    } finally {
      submissionLocked.current = false;
      setIsSubmitting(false);
    }
  }

  return (
    <section className="rounded-2xl border border-[#293954] bg-[#122344] p-6 md:p-8">
      <h2 className="text-xl font-semibold text-white">{support ? "Support this campaign" : "Deposit Revenue"}</h2>
      <p className="mt-2 text-sm leading-6 text-[#A9B6CF]">
        {support ? "Your payment enters this campaign’s revenue pool. Current revenue-right owners and the treasury can claim their allocated shares." : "Deposit native NEAR into this campaign. Beneficiaries can claim their shares from the Zinc contract."}
      </p>
      {!isActive && (
        <p className="mt-4 text-sm text-[#FF8E9C]">{support ? "Campaign support is not open. Payments are accepted only during the support window shown on this page." : "Deposits are only available while the campaign is Active."}</p>
      )}
      {!accountId && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <p className="text-sm text-[#A9B6CF]">{support ? "Connect a NEAR Testnet wallet to support this campaign." : "Connect a NEAR Testnet wallet to deposit revenue."}</p>
          <button type="button" onClick={connect} disabled={busy} className="rounded-xl border border-[#FF8E9C]/25 px-4 py-2 text-sm font-semibold text-[#FF8E9C] disabled:opacity-50">
            Connect Wallet
          </button>
        </div>
      )}
      {support && accountId && <p className="mt-4 break-all text-xs text-[#A9B6CF]">Paying from: {accountId}</p>}
      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        <label className="block" htmlFor="deposit-amount">
          <span className="mb-2 block text-sm text-[#A9B6CF]">{support ? "Support amount (testnet NEAR)" : "Amount (NEAR)"}</span>
          <input
            id="deposit-amount"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={amount}
            onChange={(event) => { setAmount(event.target.value); setError(null); setReview(null); setReceipt(null); }}
            placeholder="0.1"
            disabled={busy || !isActive || review !== null}
            aria-invalid={Boolean(amount && amountError)}
            aria-describedby={amount && amountError ? "deposit-amount-error" : undefined}
            className="w-full rounded-xl border border-[#293954] bg-[#0B1933] px-4 py-3.5 text-sm text-white outline-none placeholder:text-[#71809D] focus:border-[#FF8E9C]/40 disabled:opacity-50 sm:max-w-sm"
          />
        </label>
        {amount && amountError && <p id="deposit-amount-error" className="text-sm text-[#FF8E9C]">{amountError}</p>}
        {!review ? <button
          type="submit"
          disabled={busy || !isActive || !selector || !accountId || Boolean(amountError)}
          className="rounded-xl bg-gradient-to-r from-[#ff685b] to-[#ff8a9c] px-6 py-3.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isSubmitting ? "Waiting for wallet / network..." : isRefreshing ? "Refreshing Campaign..." : support ? "Review support payment" : "Review deposit"}
        </button> : <DepositReview review={review} campaignId={campaignId} support={support} active={isActive} busy={busy} submitting={isSubmitting} refreshing={isRefreshing} onBack={() => { setReview(null); setError(null); }} onConfirm={() => { void confirmDeposit(); }} />}
        {(busy || receipt || (error && transaction.progress?.phase !== "confirmed")) && <TransactionProgress progress={transaction.progress} />}
        {receipt && <DepositReceipt key={receipt.hash ?? "confirmed-deposit"} receipt={receipt} support={support} />}
        {error && <p role="alert" className="text-sm text-[#FF8E9C]">{error}</p>}
      </form>
    </section>
  );
}
