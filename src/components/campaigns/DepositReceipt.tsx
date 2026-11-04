"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { yoctoToNear } from "near-api-js";

export type ConfirmedDeposit = { campaignId: number; accountId: string; hash: string | null; amountYocto: string | null };

export default function DepositReceipt({ receipt, support }: { receipt: ConfirmedDeposit; support: boolean }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, []);
  return <section aria-label="Confirmed campaign payment" className="rounded-xl border border-[#69dab8]/25 bg-[#153c39]/60 p-5">
    <h3 ref={heading} tabIndex={-1} role="status" className="font-semibold text-[#69dab8] outline-none">{support ? "Support payment confirmed" : "Revenue deposit confirmed"}</h3>
    <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2"><Field label="Verified attached amount" value={receipt.amountYocto !== null ? `${yoctoToNear(BigInt(receipt.amountYocto))} NEAR` : "Amount evidence unavailable; inspect the transaction"} /><Field label="Paid from" value={receipt.accountId} /><Field label="Campaign" value={`#${receipt.campaignId}`} /></dl>
    <p className="mt-4 text-sm leading-6 text-[#A9B6CF]">Your transaction succeeded. The campaign total may still be refreshing; a later read failure does not mean this payment failed. Do not repeat the payment to fix a loading problem.</p>
    <p className="mt-3 text-xs leading-5 text-[#91b9ae]">Revenue owners claim their shares from the contract. This payment does not transfer an NFT to you. Network gas is separate from the amount deposited.</p>
    <div className="mt-4 flex flex-wrap gap-4 text-sm text-[#69dab8]">{receipt.hash && <a href={`https://testnet.nearblocks.io/txns/${encodeURIComponent(receipt.hash)}`} target="_blank" rel="noopener noreferrer">View confirmed payment ↗</a>}<Link href={`/campaigns/${receipt.campaignId}`}>View campaign &amp; revenue rights ↗</Link><Link href="/transactions">View Zinc activity ↗</Link></div>
  </section>;
}
function Field({ label, value }: { label: string; value: string }) { return <div className="min-w-0"><dt className="text-xs text-[#91b9ae]">{label}</dt><dd className="mt-1 break-all text-white">{value}</dd></div>; }
