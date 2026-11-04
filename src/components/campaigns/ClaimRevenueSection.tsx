"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { yoctoToNear } from "near-api-js";
import type { WalletSelector } from "@near-wallet-selector/core";
import { useWallet } from "../wallet/WalletProvider";
import { getClaimable, getClaimed } from "../../lib/zinc-contract";
import { claimRevenueOnNear } from "../../lib/zinc-write";
import { useReadRefresh } from "../data/useReadRefresh";
import TransactionProgress, { useTransactionProgress } from "../transactions/TransactionProgress";
import ClaimReceipt, { type ConfirmedClaim } from "./ClaimReceipt";
import { successfulClaimAmount } from "../../lib/claim-receipt";
import { validTransactionHash } from "../../lib/transaction-journal";

type ClaimRevenueSectionProps = {
  campaignId: number;
  totalDepositedYocto: string;
};

const claimButtonClass = "rounded-xl bg-gradient-to-r from-[#ff685b] to-[#ff8a9c] px-6 py-3.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40";

export default function ClaimRevenueSection(props: ClaimRevenueSectionProps) {
  const { selector, accountId, connect } = useWallet();

  return (
    <section id="claim-revenue" className="scroll-mt-6 rounded-2xl border border-[#293954] bg-[#122344] p-6 md:p-8">
      <h2 className="text-xl font-semibold text-white">Claim Revenue</h2>
      {accountId ? (
        <AccountClaims key={`${props.campaignId}:${accountId}`} {...props} accountId={accountId} selector={selector} />
      ) : (
        <div className="mt-4 space-y-4">
          <p className="text-sm text-[#A9B6CF]">Connect a NEAR Testnet wallet to view and claim your campaign revenue.</p>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={connect} className="rounded-xl border border-[#FF8E9C]/25 px-4 py-2 text-sm font-semibold text-[#FF8E9C]">Connect Wallet</button>
            <button type="button" disabled className={claimButtonClass}>Claim Revenue</button>
          </div>
        </div>
      )}
    </section>
  );
}

function AccountClaims({ campaignId, totalDepositedYocto, accountId, selector }: ClaimRevenueSectionProps & {
  accountId: string;
  selector: WalletSelector | null;
}) {
  const router = useRouter();
  const transaction = useTransactionProgress();
  const [balances, setBalances] = useState<{ claimable: string; claimed: string } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [transactionError, setTransactionError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<ConfirmedClaim | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { version: refreshIndex, refresh: refreshData } = useReadRefresh();
  const submissionLocked = useRef(false);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Never expose a previous account/campaign's payout balance during an external read refresh.
    setBalances(null);
    setLoadError(null);
    async function load() {
      try {
        const [claimable, claimed] = await Promise.all([
          getClaimable(campaignId, accountId),
          getClaimed(campaignId, accountId),
        ]);
        if (!/^\d+$/.test(claimable) || !/^\d+$/.test(claimed)) {
          throw new Error("Invalid revenue balance returned by NEAR.");
        }
        if (!cancelled) setBalances({ claimable, claimed });
      } catch {
        if (!cancelled) setLoadError("Could not load your revenue balances from NEAR Testnet. Please refresh balances to try again.");
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [campaignId, accountId, totalDepositedYocto, refreshIndex]);

  function refreshBalances() {
    setBalances(null);
    refreshData();
  }

  async function claim() {
    if (submissionLocked.current || isSubmitting || !selector || !balances || BigInt(balances.claimable) === BigInt(0)) return;
    const currentAccount = selector.store.getState().accounts.find((account) => account.active)?.accountId;
    if (currentAccount !== accountId) {
      setTransactionError("Your connected account changed. Wait for your wallet balances to reload before claiming.");
      return;
    }
    submissionLocked.current = true;
    setIsSubmitting(true);
    setTransactionError(null);
    setReceipt(null);
    try {
      const outcome = await transaction.run((report) => claimRevenueOnNear(selector, campaignId, report));
      setReceipt({ campaignId, accountId, hash: validTransactionHash(outcome.transaction.hash) ? outcome.transaction.hash : null,
        amountYocto: successfulClaimAmount(outcome, accountId) });
      refreshBalances();
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message
        : typeof error === "string" ? error : "Your wallet could not complete the claim. Check your wallet activity before retrying.";
      setTransactionError(/reject|cancel|denied|declin/i.test(message)
        ? "Transaction cancelled or rejected in your wallet. No claim was confirmed."
        : message);
      refreshBalances();
    } finally {
      submissionLocked.current = false;
      setIsSubmitting(false);
    }
  }

  const loading = !balances && !loadError;
  const canClaim = Boolean(selector && balances && BigInt(balances.claimable) > BigInt(0));

  return (
    <div className="mt-4 space-y-5">
      <p className="break-all text-sm text-[#A9B6CF]">Revenue for {accountId}</p>
      <dl className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-[#293954] bg-[#0B1933] p-5">
          <dt className="text-xs text-[#71809D]">Claimable revenue</dt>
          <dd className="mt-2 break-all text-xl font-semibold text-[#FF8E9C]">{balances ? `${yoctoToNear(BigInt(balances.claimable))} NEAR` : loading ? "Loading…" : "Unavailable"}</dd>
        </div>
        <div className="rounded-xl border border-[#293954] bg-[#0B1933] p-5">
          <dt className="text-xs text-[#71809D]">Claimed revenue</dt>
          <dd className="mt-2 break-all text-xl font-semibold text-white">{balances ? `${yoctoToNear(BigInt(balances.claimed))} NEAR` : loading ? "Loading…" : "Unavailable"}</dd>
        </div>
      </dl>
      <p className="text-xs leading-5 text-[#71809D]">Claimed revenue includes any payout awaiting confirmation.</p>
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={claim} disabled={!canClaim || isSubmitting} className={claimButtonClass}>
          {isSubmitting ? "Confirming Claim…" : "Claim Revenue"}
        </button>
        <button type="button" onClick={refreshBalances} disabled={loading || isSubmitting} className="rounded-xl border border-[#293954] px-4 py-3 text-sm font-medium text-[#A9B6CF] transition hover:text-white disabled:opacity-40">
          Refresh balances
        </button>
      </div>
      {loading && <p role="status" className="text-sm text-[#A9B6CF]">Loading revenue balances…</p>}
      <TransactionProgress progress={transaction.progress} />
      {receipt && <ClaimReceipt key={receipt.hash ?? "confirmed-claim"} receipt={receipt} />}
      {balances && !canClaim && !receipt && <p className="text-sm text-[#A9B6CF]">No revenue is currently available to claim for this account.</p>}
      {loadError && <p role="alert" className="text-sm text-[#FF8E9C]">{loadError}</p>}
      {transactionError && <p role="alert" className="text-sm text-[#FF8E9C]">{transactionError}</p>}
    </div>
  );
}
