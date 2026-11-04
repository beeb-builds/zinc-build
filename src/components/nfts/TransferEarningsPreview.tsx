"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { yoctoToNear } from "near-api-js";
import { getClaimable, getClaimed } from "../../lib/zinc-contract";

type Balances = { claimable: string; claimed: string };
type Snapshot = { campaignId: number; accountId: string } & (
  { status: "ready"; balances: Balances } | { status: "error" }
);

/** Contract views are account/campaign totals, never an individual NFT balance. */
export async function readTransferEarnings(campaignId: number, accountId: string): Promise<Balances> {
  const [claimable, claimed] = await Promise.all([getClaimable(campaignId, accountId), getClaimed(campaignId, accountId)]);
  if ([claimable, claimed].some((value) => typeof value !== "string" || !/^\d+$/.test(value))) {
    throw new Error("NEAR returned an invalid earnings balance.");
  }
  return { claimable, claimed };
}

export default function TransferEarningsPreview({ campaignId, accountId, busy }: { campaignId: number; accountId: string; busy: boolean }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- A new account/campaign or explicit retry invalidates the advisory external balance snapshot.
    setSnapshot(null);
    void readTransferEarnings(campaignId, accountId).then(
      (balances) => { if (!cancelled) setSnapshot({ campaignId, accountId, status: "ready", balances }); },
      () => { if (!cancelled) setSnapshot({ campaignId, accountId, status: "error" }); },
    );
    return () => { cancelled = true; };
  }, [campaignId, accountId, retry]);
  // Do not flash another account's balance while a new effect is starting.
  const current = snapshot?.campaignId === campaignId && snapshot.accountId === accountId ? snapshot : null;
  return <TransferEarningsView campaignId={campaignId} accountId={accountId} busy={busy}
    status={current?.status ?? "loading"} balances={current?.status === "ready" ? current.balances : null}
    onRetry={() => { setSnapshot(null); setRetry((value) => value + 1); }} />;
}

export function TransferEarningsView({ campaignId, accountId, busy, status, balances, onRetry }: {
  campaignId: number; accountId: string; busy: boolean;
  status: "loading" | "ready" | "error"; balances: Balances | null; onRetry: () => void;
}) {
  return <section aria-label="Earnings you keep after transfer" className="rounded-xl border border-[#69dab8]/20 bg-[#153c39]/40 p-4">
    <h5 className="text-sm font-semibold text-[#69dab8]">Earnings you keep</h5>
    <p className="mt-2 break-all text-xs leading-5 text-[#A9B6CF]">Campaign #{campaignId} earnings for {accountId}</p>
    {status === "loading" ? <p role="status" className="mt-3 text-xs text-[#A9B6CF]">Reading your campaign earnings from NEAR...</p>
      : status === "ready" && balances ? <dl className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="min-w-0"><dt className="text-xs text-[#71809D]">Claimable now</dt><dd className="mt-1 break-all text-sm font-semibold text-white">{yoctoToNear(BigInt(balances.claimable))} NEAR</dd></div>
        <div className="min-w-0"><dt className="text-xs text-[#71809D]">Already claimed</dt><dd className="mt-1 break-all text-sm font-semibold text-white">{yoctoToNear(BigInt(balances.claimed))} NEAR</dd></div>
      </dl>
      : <div role="alert" className="mt-3 text-xs leading-5 text-[#A9B6CF]">Earnings are unavailable, not zero. You can inspect them on the campaign page. This lookup does not change or block your transfer.<button type="button" disabled={busy} onClick={onRetry} className="mt-2 block text-[#FF8E9C] underline disabled:opacity-40">Retry earnings lookup</button></div>}
    <p className="mt-3 text-xs leading-5 text-[#A9B6CF]">These are campaign-wide totals for your wallet, including other rights or treasury earnings where applicable. They are not a balance stored in this NFT.</p>
    <p className="mt-2 text-xs leading-5 text-[#71809D]">The transfer leaves previously earned revenue with you. Deposits and claims can change these amounts before the transfer executes. You do not need to claim first.</p>
    <Link href={`/campaigns/${campaignId}#claim-revenue`} className="mt-3 inline-flex text-xs text-[#69dab8]">View &amp; claim campaign earnings</Link>
  </section>;
}
