"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowUpRight, RefreshCw, Wallet } from "lucide-react";
import type { WalletSelector } from "@near-wallet-selector/core";
import { yoctoToNear } from "near-api-js";
import { useWallet } from "../wallet/WalletProvider";
import { getAllNftTokensForOwner, getCampaigns, getCampaignRights, getClaimable, getClaimed, getNftToken, getRevenueRight, type OnChainNftToken, type OnChainRevenueRight } from "../../lib/zinc-contract";
import { useReadRefresh } from "../data/useReadRefresh";
import { transferRevenueRightOnNear, validateNftReceiver } from "../../lib/zinc-write";
import RevenueRightCard, { rightHref } from "./RevenueRightCard";
import TransactionProgress, { useTransactionProgress, type TransactionProgressState } from "../transactions/TransactionProgress";
import { getSharedActivity } from "../../lib/zinc-activity";
import { previouslyHeldRightIds } from "../../lib/right-history";
import { validTransactionHash } from "../../lib/transaction-journal";
import TransferReceipt, { type ConfirmedTransfer } from "./TransferReceipt";
import TransferEarningsPreview from "./TransferEarningsPreview";

type OwnedNft = { token: OnChainNftToken; right: OnChainRevenueRight | null; campaignName: string | null };
type TransferredRight = { right: OnChainRevenueRight; campaignName: string; originalContributor: string };
type HistoricalBalance = { campaignId: number; campaignName: string; claimable: string; claimed: string };
function exactNear(amount: string): string {
  if (typeof amount !== "string" || !/^\d+$/.test(amount)) throw new Error("NEAR returned an invalid revenue balance.");
  return yoctoToNear(BigInt(amount));
}
const primaryButton = "rounded-xl bg-gradient-to-r from-[#ff685b] to-[#ff8a9c] px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40";

export default function MyNfts() {
  const { accountId, selector, connect, isInitializing } = useWallet();
  return (
    <div className="mx-auto max-w-7xl">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#ff7568]">Revenue ownership</p>
      <h2 className="mt-2 text-3xl font-semibold text-white">My NFTs</h2>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-[#A9B6CF]">Your share of what comes next. Each NFT controls a contributor’s share of future campaign deposits. Open a right to inspect its ownership, agreement, and earnings.</p>
      {accountId ? (
        <OwnedNfts key={accountId} accountId={accountId} selector={selector} />
      ) : isInitializing ? <section role="status" className="mt-7 rounded-2xl border border-[#293954] bg-[#122344] p-8"><h3 className="text-lg font-semibold">Restoring your wallet</h3><p className="mt-2 text-sm text-[#A9B6CF]">Checking for a saved NEAR Testnet session before loading your revenue-right NFTs. You can keep browsing while the wallet prepares.</p></section> : (
        <section className="mt-7 rounded-2xl border border-[#293954] bg-[#122344] p-8">
          <Wallet size={28} className="text-[#FF8E9C]" />
          <h3 className="mt-4 text-lg font-semibold">Connect your wallet</h3>
          <p className="mt-2 text-sm text-[#A9B6CF]">Connect a NEAR Testnet wallet to view your Zinc revenue-right NFTs. You can also explore campaign rights without connecting.</p>
          <button type="button" onClick={connect} className={`mt-5 ${primaryButton}`}>Connect Wallet</button>
          <Link href="/campaigns" className="ml-4 mt-5 inline-flex text-sm text-[#FF8E9C]">Explore campaign rights <ArrowUpRight size={16} /></Link>
        </section>
      )}
    </div>
  );
}

function metadataCampaignName(token: OnChainNftToken): string | null {
  try {
    const extra: unknown = JSON.parse(token.metadata?.extra ?? "null");
    if (extra && typeof extra === "object" && "campaign_name" in extra && typeof extra.campaign_name === "string") return extra.campaign_name;
  } catch { /* A missing metadata name does not prevent displaying the right. */ }
  return null;
}

function OwnedNfts({ accountId, selector }: { accountId: string; selector: WalletSelector | null }) {
  const transaction = useTransactionProgress();
  const [nfts, setNfts] = useState<OwnedNft[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(true);
  const [transferred, setTransferred] = useState<TransferredRight[] | null>(null);
  const [balances, setBalances] = useState<HistoricalBalance[] | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [balanceError, setBalanceError] = useState<string | null>(null);
  // Also recognize received rights transferred onward during this page session.
  const observedRights = useRef(new Set<string>());
  const [receipt, setReceipt] = useState<ConfirmedTransfer | null>(null);
  const [sharedHistoryUnavailable, setSharedHistoryUnavailable] = useState(false);
  const { version: refreshIndex, refresh: refreshData } = useReadRefresh();
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const submissionLocked = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Synchronize the pending state with cancellable external ownership reads, preserving mounted transfer drafts.
    setRefreshing(true);
    setLoadError(null);
    setTransferred(null);
    setHistoryError(null);
    setBalanceError(null);
    setBalances(null);
    setSharedHistoryUnavailable(false);
    async function load() {
      try {
        const [tokens, campaigns] = await Promise.all([getAllNftTokensForOwner(accountId), getCampaigns().catch(() => null)]);
        const rights = await Promise.all(tokens.map(async (token) => {
          try { return await getRevenueRight(token.token_id); } catch { return null; }
        }));
        const names = new Map((campaigns ?? []).map((campaign) => [campaign.id, campaign.name]));
        const owned = tokens.flatMap((token, index) => {
          const right = rights[index];
          if ((right?.owner_id ?? token.owner_id) !== accountId) return [];
          return [{ token: { ...token, owner_id: right?.owner_id ?? token.owner_id }, right,
            campaignName: (right ? names.get(right.campaign_id) : null) ?? metadataCampaignName(token) }];
        });
        if (!cancelled) {
          owned.forEach((nft) => observedRights.current.add(nft.token.token_id));
          setNfts(owned);
        }
      } catch (error) {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : "Could not load your NFTs from NEAR Testnet.");
      } finally {
        if (!cancelled) setRefreshing(false);
      }
    }
    async function loadHistory() {
      try {
        const [campaigns, events] = await Promise.all([getCampaigns(), getSharedActivity(undefined, undefined, controller.signal, accountId).catch(() => null)]);
        if (cancelled) return;
        setSharedHistoryUnavailable(events === null);
        const previouslyHeld = previouslyHeldRightIds(events ?? [], accountId);
        const groups = await Promise.all(campaigns.map(async (campaign) => {
          const rights = await getCampaignRights(campaign.id);
          return rights.flatMap((right): TransferredRight[] => {
            const originalContributor = campaign.contributors[right.contributor_index]?.account_id;
            if (right.owner_id === accountId || !originalContributor) return [];
            if (originalContributor !== accountId && !observedRights.current.has(right.token_id) && !previouslyHeld.has(right.token_id)) return [];
            return [{ right, campaignName: campaign.name, originalContributor }];
          });
        }));
        const previous = groups.flat();
        if (cancelled) return;
        setTransferred(previous);
        try {
          const campaignIds = [...new Set(previous.map(({ right }) => right.campaign_id))];
          const revenue = await Promise.all(campaignIds.map(async (campaignId) => {
            const [claimable, claimed] = await Promise.all([getClaimable(campaignId, accountId), getClaimed(campaignId, accountId)]);
            exactNear(claimable); exactNear(claimed);
            return { campaignId, campaignName: campaigns.find((campaign) => campaign.id === campaignId)!.name, claimable, claimed };
          }));
          if (!cancelled) setBalances(revenue);
        } catch {
          if (!cancelled) setBalanceError("Historical revenue balances could not be loaded. Refresh NFTs to retry.");
        }
      } catch (error) {
        if (!cancelled) setHistoryError(error instanceof Error ? error.message : "Could not load transferred rights.");
      }
    }
    void load();
    void loadHistory();
    return () => { cancelled = true; controller.abort(); };
  }, [accountId, refreshIndex]);

  function refresh() { setRefreshing(true); refreshData(); }

  async function transfer(tokenId: string, receiverInput: string) {
    if (submissionLocked.current) return;
    if (!selector) throw new Error("Connect your wallet before transferring.");
    const receiver = validateNftReceiver(receiverInput, accountId);
    submissionLocked.current = true;
    setPendingToken(tokenId);
    setReceipt(null);
    try {
      const outcome = await transaction.run(async (report) => {
        const current = await getNftToken(tokenId, true);
        if (!current || current.owner_id !== accountId) {
          refresh();
          throw new Error("You no longer own this NFT. Your ownership list is being refreshed.");
        }
        return transferRevenueRightOnNear(selector, tokenId, receiver, accountId, report);
      });
      observedRights.current.add(tokenId);
      setReceipt({ tokenId, from: accountId, to: receiver, hash: validTransactionHash(outcome.transaction.hash) ? outcome.transaction.hash : null,
        campaignId: nfts?.find((nft) => nft.token.token_id === tokenId)?.right?.campaign_id });
      setNfts((current) => current?.filter((nft) => nft.token.token_id !== tokenId) ?? null);
      refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : typeof error === "string" ? error : "Your wallet could not complete the NFT transfer.";
      throw new Error(/reject|cancel|denied|declin/i.test(message)
        ? "Transaction cancelled or rejected in your wallet. No transfer was confirmed."
        : message);
    } finally {
      submissionLocked.current = false;
      setPendingToken(null);
    }
  }

  return (
    <div className="mt-7 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[#293954] bg-[#0B1933] p-4">
        <p className="min-w-0 break-all text-sm text-[#A9B6CF]">Owned by <span className="font-medium text-white">{accountId}</span></p>
        <button type="button" onClick={refresh} disabled={pendingToken !== null || refreshing} className="inline-flex items-center gap-2 rounded-xl border border-[#293954] px-4 py-2 text-sm text-[#A9B6CF] transition hover:text-white disabled:opacity-40"><RefreshCw size={15} /> Refresh NFTs</button>
      </div>
      {receipt && <TransferReceipt transfer={receipt} />}
      {pendingToken === null && <TransactionProgress progress={transaction.progress} />}
      <div className="flex flex-wrap gap-6 text-sm text-[#A9B6CF]">
        <p>Current Rights Owned: <span className="font-semibold text-white">{nfts?.length ?? (loadError ? "Unavailable" : "Loading...")}</span></p>
        <p>Previously Transferred Rights: <span className="font-semibold text-white">{transferred?.length ?? (historyError ? "Unavailable" : "Loading...")}</span></p>
      </div>
      {refreshing && nfts !== null && <p role="status" className="text-sm text-[#A9B6CF]">Refreshing NFT ownership. Your transfer draft is kept; confirmation is paused until the check finishes.</p>}
      {loadError && (
        <div role="alert" className="rounded-2xl border border-[#FF8E9C]/20 bg-[#122344] p-6"><h3 className="font-semibold">Unable to load NFTs</h3><p className="mt-2 text-sm text-[#A9B6CF]">{loadError} Use Refresh NFTs to try again.</p></div>
      )}
      {!nfts ? (
        !loadError && <p role="status" className="py-8 text-sm text-[#A9B6CF]">Loading your revenue-right NFTs…</p>
      ) : nfts.length === 0 ? (
        <div className="rounded-2xl border border-[#293954] bg-[#122344] p-8"><h3 className="text-lg font-semibold">No revenue-right NFTs</h3><p className="mt-2 text-sm text-[#A9B6CF]">This wallet does not currently own any Zinc revenue-right NFTs.</p><Link href="/campaigns" className="mt-4 inline-flex text-sm font-medium text-[#FF8E9C]">View campaigns <ArrowUpRight size={16} /></Link></div>
      ) : (
        <div className="grid items-start gap-5 lg:grid-cols-2 xl:grid-cols-3">
          {nfts.map((nft) => <NftCard key={nft.token.token_id} nft={nft} busy={pendingToken !== null || refreshing || loadError !== null} submitting={pendingToken === nft.token.token_id} progress={pendingToken === nft.token.token_id ? transaction.progress : null} onTransfer={transfer} />)}
        </div>
      )}
      <section className="space-y-5 border-t border-[#293954] pt-7">
        <h2 className="text-2xl font-semibold text-white">Transferred Rights</h2>
        <p className="text-sm leading-6 text-[#A9B6CF]">Previously earned revenue remains with the former owner. Future revenue follows the current NFT owner.</p>
        <p className="text-xs leading-5 text-[#71809D]">Shows rights originally allocated to this wallet, rights seen during this page session, and rights linked to this wallet by verified mint/transfer events, when their current owner is different. Shared evidence covers the latest 200 recorded ownership events involving this account; missing imports can leave gaps. Current owner is read from the contract, not inferred from an old transfer recipient.</p>
        {sharedHistoryUnavailable && <p role="alert" className="text-sm text-[#FF8E9C]">Shared ownership history is unavailable. Original-contributor rights and rights seen in this session are still shown. Refresh NFTs to retry received-right history.</p>}
        {historyError ? <p role="alert" className="text-sm text-[#FF8E9C]">{historyError} Use Refresh NFTs to retry.</p>
          : !transferred ? <p role="status" className="text-sm text-[#A9B6CF]">Loading transferred rights...</p>
          : transferred.length === 0 ? <p className="rounded-2xl border border-[#293954] bg-[#122344] p-6 text-sm text-[#A9B6CF]">No transferred rights found for this wallet in the available ownership data.</p>
          : <>
            <div className="grid items-start gap-5 lg:grid-cols-2 xl:grid-cols-3">
              {transferred.map(({ right, campaignName, originalContributor }) => <article key={right.token_id} className="min-w-0 rounded-2xl border border-[#293954] bg-[#122344] p-5">
                <RevenueRightCard right={right} campaignName={campaignName} status="Transferred" />
                <dl className="mt-5 space-y-4">
                  <Field label="Token ID" value={right.token_id} />
                  <Field label="Campaign ID" value={String(right.campaign_id)} />
                  <Field label="Role" value={right.role} />
                  <Field label="Revenue share" value={`${right.share_bps / 100}%`} />
                  <Field label="Current owner" value={right.owner_id} />
                  <Field label="Original contributor" value={originalContributor} />
                </dl>
                <Link href={`/campaigns/${right.campaign_id}`} className="mt-5 inline-flex items-center gap-1 text-sm text-[#FF8E9C]">View campaign &amp; historical revenue <ArrowUpRight size={15} /></Link>
                <Link href={`/transactions?token=${encodeURIComponent(right.token_id)}`} className="mt-3 block text-sm text-[#A9B6CF] hover:text-white">View available transfer activity</Link>
              </article>)}
            </div>
            <h3 className="text-lg font-semibold">Historical revenue by campaign</h3>
            <p className="text-xs leading-5 text-[#71809D]">Balances belong to your account per campaign, not to an individual NFT. They may include other rights or a treasury share. Each campaign balance is shown once.</p>
            {balanceError ? <p role="alert" className="text-sm text-[#FF8E9C]">{balanceError}</p>
              : !balances ? <p role="status" className="text-sm text-[#A9B6CF]">Loading historical balances...</p>
              : balances.map((balance) => <div key={balance.campaignId} className="rounded-xl border border-[#293954] bg-[#122344] p-5">
                <Link href={`/campaigns/${balance.campaignId}`} className="break-words font-semibold text-[#FF8E9C]">{balance.campaignName} · #{balance.campaignId}</Link>
                <dl className="mt-4 grid gap-4 sm:grid-cols-2"><Field label="Historical Claimable · campaign account balance" value={`${exactNear(balance.claimable)} NEAR`} /><Field label="Historical Claimed · campaign account total" value={`${exactNear(balance.claimed)} NEAR`} /></dl>
                {BigInt(balance.claimable) > BigInt(0) && <Link href={`/campaigns/${balance.campaignId}`} className="mt-4 inline-flex text-sm text-[#FF8E9C]">Claim on campaign page <ArrowUpRight size={16} /></Link>}
              </div>)}
          </>}
      </section>
    </div>
  );
}

function NftCard({ nft, busy, submitting, progress, onTransfer }: {
  nft: OwnedNft; busy: boolean; submitting: boolean;
  progress: TransactionProgressState | null;
  onTransfer: (tokenId: string, receiver: string) => Promise<void>;
}) {
  const [receiver, setReceiver] = useState("");
  const [reviewedReceiver, setReviewedReceiver] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { token, right, campaignName } = nft;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError(null);
    if (!right) { setError("Refresh NFT details before reviewing this transfer."); return; }
    try { setReviewedReceiver(validateNftReceiver(receiver, token.owner_id)); }
    catch (error) { setError(error instanceof Error ? error.message : "Enter a valid receiver."); }
  }
  async function confirmTransfer() {
    if (busy || !reviewedReceiver || !right) return;
    setError(null);
    try { await onTransfer(token.token_id, reviewedReceiver); }
    catch (error) { setError(error instanceof Error ? error.message : "Could not transfer this NFT."); }
  }
  return (
    <article id={token.token_id} className="min-w-0 scroll-mt-6 rounded-2xl border border-[#293954] bg-[#122344] p-5">
      {right ? <RevenueRightCard right={right} campaignName={campaignName ?? `Campaign #${right.campaign_id}`} status="Owned by you" /> : <Link href={rightHref(token.token_id)} className="block rounded-xl border border-[#293954] p-5 text-[#FF8E9C]">{campaignName ?? token.metadata?.title ?? "Zinc Revenue Right"} · Inspect NFT <ArrowUpRight className="inline" size={16} /></Link>}
      <dl className="mt-5 space-y-4">
        <Field label="Token ID" value={token.token_id} />
        <div className="grid grid-cols-2 gap-4"><Field label="Campaign ID" value={right ? String(right.campaign_id) : "Unavailable"} /><Field label="Revenue share" value={right ? `${right.share_bps / 100}%` : "Unavailable"} /></div>
        <Field label="Role" value={right?.role ?? "Unavailable"} />
        <Field label="Current owner" value={token.owner_id} />
      </dl>
      <p className="mt-4 text-sm text-[#A9B6CF]">Future revenue follows this NFT.</p>
      {!right && <p className="mt-4 text-xs leading-5 text-[#FF8E9C]">Some right details could not be loaded. Refresh NFTs to try again.</p>}
      <details className="mt-5 border-t border-[#293954] pt-4">
        <summary className="cursor-pointer text-sm font-semibold text-[#FF8E9C]">Details &amp; transfer</summary>
        {right && <Link href={`/campaigns/${right.campaign_id}`} className="mt-4 inline-flex items-center gap-1 text-sm text-[#A9B6CF] hover:text-white">View campaign <ArrowUpRight size={15} /></Link>}
        <p className="mt-4 text-sm leading-6 text-[#A9B6CF]">The receiver will own this right and earn its future revenue. Revenue you already earned stays claimable by you.</p>
        <form onSubmit={submit} className="mt-4 space-y-3">
          <label className="block"><span className="mb-2 block text-sm text-[#A9B6CF]">Receiver account ID</span><input value={receiver} onChange={(event) => { setReceiver(event.target.value); setError(null); setReviewedReceiver(null); }} disabled={busy || reviewedReceiver !== null} placeholder="bob.testnet or implicit account" autoComplete="off" autoCapitalize="none" spellCheck={false} className="w-full rounded-xl border border-[#293954] bg-[#0B1933] px-3 py-3 text-sm text-white outline-none placeholder:text-[#71809D] focus:border-[#FF8E9C]/40 disabled:opacity-50" /></label>
          <p className="text-xs leading-5 text-[#71809D]">Requires exactly 1 yoctoNEAR plus network gas, confirmed in your wallet.</p>
          {!reviewedReceiver ? <button type="submit" disabled={busy || !receiver.trim() || !right} className={`w-full ${primaryButton}`}>Review Transfer</button> : right && <section aria-label="Review revenue-right transfer" className="space-y-4 rounded-xl border border-[#FF8E9C]/30 bg-[#0B1933] p-4">
            <h4 className="font-semibold text-white">Review your transfer</h4>
            <dl className="space-y-3"><Field label="NFT / Campaign" value={`${token.token_id} / ${campaignName ?? `Campaign #${right.campaign_id}`}`} /><Field label="Role / Future revenue share" value={`${right.role} / ${right.share_bps / 100}%`} /><Field label="From" value={token.owner_id} /><Field label="To" value={reviewedReceiver} /><Field label="Attached deposit" value="Exactly 1 yoctoNEAR, plus network gas" /></dl>
            <p className="text-sm leading-6 text-[#FF8E9C]">The receiver gets this NFT and its {right.share_bps / 100}% share of future campaign deposits.</p>
            <p className="text-sm leading-6 text-[#A9B6CF]">You keep revenue earned before the transfer executes. Your accrued balance stays claimable by you; the treasury allocation stays with the treasury account.</p>
            <TransferEarningsPreview campaignId={right.campaign_id} accountId={token.owner_id} busy={busy} />
            <p className="text-xs leading-5 text-[#71809D]">Check the full receiver account carefully. Transfers do not include a sale payment. Ownership is checked again before requesting your signature.</p>
            <div className="flex flex-wrap gap-3"><button type="button" onClick={() => { setReviewedReceiver(null); setError(null); }} disabled={busy} className="rounded-xl border border-[#293954] px-4 py-3 text-sm text-[#A9B6CF] disabled:opacity-40">Back &amp; edit</button><button type="button" onClick={confirmTransfer} disabled={busy} className={primaryButton}>{submitting ? "Waiting for wallet / network..." : "Confirm in wallet"}</button></div>
          </section>}
          {error && <p role="alert" className="text-sm text-[#FF8E9C]">{error}</p>}
          <TransactionProgress progress={progress} />
        </form>
      </details>
    </article>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><dt className="text-xs text-[#71809D]">{label}</dt><dd className="mt-1 break-all text-sm font-medium text-white">{value}</dd></div>;
}
