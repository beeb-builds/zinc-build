"use client";

import { useEffect, useRef, useState, type Ref } from "react";
import Link from "next/link";
import { yoctoToNear } from "near-api-js";
import { ACTIVITY_CHANGED, getSharedActivity } from "../../lib/zinc-activity";

export type ConfirmedClaim = { campaignId: number; accountId: string; hash: string | null; amountYocto: string | null };

export default function ClaimReceipt({ receipt }: { receipt: ConfirmedClaim }) {
  const heading = useRef<HTMLHeadingElement>(null);
  const [amount, setAmount] = useState(receipt.amountYocto);
  const [loading, setLoading] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [version, setVersion] = useState(0);
  useEffect(() => { heading.current?.focus(); }, []);
  useEffect(() => {
    const changed = () => setVersion((value) => value + 1);
    window.addEventListener(ACTIVITY_CHANGED, changed);
    return () => window.removeEventListener(ACTIVITY_CHANGED, changed);
  }, []);
  useEffect(() => {
    if (receipt.amountYocto || !receipt.hash) return;
    const controller = new AbortController(); let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Reset evidence lookup status when a receipt or verified-activity notification changes.
    setLoading(true); setUnavailable(false);
    void getSharedActivity(receipt.campaignId, null, controller.signal).then((rows) => {
      if (cancelled) return;
      const verified = rows.find((row) => row.source === "rpc" && row.kind === "Claims" && row.hash === receipt.hash && row.account === receipt.accountId && row.campaignId === receipt.campaignId);
      if (verified?.amountYocto && /^\d+$/.test(verified.amountYocto) && BigInt(verified.amountYocto) > BigInt(0)) setAmount(verified.amountYocto);
      else setUnavailable(true);
    }).catch(() => { if (!cancelled) setUnavailable(true); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; controller.abort(); };
  }, [receipt, version]);
  return <ClaimReceiptView receipt={{ ...receipt, amountYocto: amount }} loading={loading} unavailable={unavailable} headingRef={heading} onRefresh={() => setVersion((value) => value + 1)} />;
}

export function ClaimReceiptView({ receipt, loading, unavailable, onRefresh, headingRef }:
  { receipt: ConfirmedClaim; loading: boolean; unavailable: boolean; onRefresh: () => void; headingRef?: Ref<HTMLHeadingElement> }) {
  return <section aria-label="Confirmed claim receipt" className="rounded-xl border border-[#69dab8]/25 bg-[#153c39]/60 p-5">
    <h3 ref={headingRef} tabIndex={-1} role="status" className="font-semibold text-[#69dab8] outline-none">Revenue payout confirmed</h3>
    <p className="mt-3 text-sm leading-6 text-[#A9B6CF]">The transfer and payout callback succeeded. A balance-refresh or receipt-loading problem does not mean your claim failed.</p>
    <dl className="mt-4 grid gap-4 sm:grid-cols-2"><Detail label="Paid to" value={receipt.accountId} /><Detail label="Campaign" value={`#${receipt.campaignId}`} /><Detail label="Verified payout amount" value={receipt.amountYocto !== null ? `${yoctoToNear(BigInt(receipt.amountYocto))} NEAR` : loading ? "Reading receipt evidence..." : "Amount not available in receipt evidence yet"} /></dl>
    <p className="mt-4 text-xs leading-5 text-[#91b9ae]">Amounts come from successful native-transfer receipts, excluding gas refunds. Network gas is paid separately. This is your campaign/account payout, which may include several rights, retained historical revenue, or treasury earnings.</p>
    {!receipt.amountYocto && unavailable && <p className="mt-3 text-xs leading-5 text-[#A9B6CF]">The payout remains confirmed. Shared history may still be saving the transaction or be unavailable. Refresh the receipt or inspect the transaction; no amount is inferred from your earlier balance.</p>}
    <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-[#69dab8]">
      {!receipt.amountYocto && receipt.hash && <button type="button" onClick={onRefresh} disabled={loading} className="rounded-lg border border-[#69dab8]/25 px-3 py-2 disabled:opacity-40">Refresh receipt amount</button>}
      {receipt.hash && <a href={`https://testnet.nearblocks.io/txns/${encodeURIComponent(receipt.hash)}`} target="_blank" rel="noopener noreferrer">View payout transaction ↗</a>}
      <Link href="/earnings">View all campaign earnings ↗</Link>
    </div>
  </section>;
}
function Detail({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><dt className="text-xs text-[#91b9ae]">{label}</dt><dd className="mt-1 break-all text-sm text-white">{value}</dd></div>;
}
