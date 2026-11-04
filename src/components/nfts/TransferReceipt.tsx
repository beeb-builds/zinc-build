"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { rightHref } from "./RevenueRightCard";

export type ConfirmedTransfer = { tokenId: string; from: string; to: string; hash: string | null; campaignId?: number };

export default function TransferReceipt({ transfer }: { transfer: ConfirmedTransfer }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, []);
  return <section aria-label="Confirmed revenue-right transfer" className="rounded-2xl border border-[#69dab8]/25 bg-[#153c39] p-5 md:p-6">
    <h3 ref={heading} tabIndex={-1} role="status" className="text-lg font-semibold text-[#69dab8] outline-none">Revenue right transferred</h3>
    <p className="mt-3 text-sm leading-6 text-[#A9B6CF]">The transaction is confirmed. Your NFT has moved to the recipient below. Check the NFT detail page for its latest owner if it moves again.</p>
    <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2"><Detail label="NFT token ID" value={transfer.tokenId} /><Detail label="Previous owner" value={transfer.from} /><Detail label="Transfer recipient" value={transfer.to} /><Detail label="Attached deposit" value="Exactly 1 yoctoNEAR, plus network gas" /></dl>
    <p className="mt-4 text-sm leading-6 text-[#A9B6CF]">You retain revenue earned before the transfer. The new owner earns this right&apos;s share of later deposits. This transfer does not include a sale payment.</p>
    <div className="mt-5 flex flex-wrap gap-4 text-sm text-[#69dab8]">
      <Link href={rightHref(transfer.tokenId)}>Inspect NFT &amp; ownership history ↗</Link>
      {transfer.campaignId !== undefined && <Link href={`/campaigns/${transfer.campaignId}`}>View retained campaign earnings ↗</Link>}
      {transfer.hash && <a href={`https://testnet.nearblocks.io/txns/${encodeURIComponent(transfer.hash)}`} target="_blank" rel="noopener noreferrer">View confirmed transaction ↗</a>}
    </div>
  </section>;
}
function Detail({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><dt className="text-xs text-[#91b9ae]">{label}</dt><dd className="mt-1 break-all text-white">{value}</dd></div>;
}
