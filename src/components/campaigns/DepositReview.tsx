"use client";

import { useEffect, useRef } from "react";
import { yoctoToNear } from "near-api-js";
import { ZINC_CONTRACT_ID } from "../../lib/near";

export type ReviewedDeposit = { accountId: string; amountYocto: string };

export default function DepositReview({ review, campaignId, support, active, busy, submitting, refreshing, onBack, onConfirm }:
  { review: ReviewedDeposit; campaignId: number; support: boolean; active: boolean; busy: boolean; submitting: boolean; refreshing: boolean; onBack: () => void; onConfirm: () => void }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, []);
  return <section aria-label="Review campaign payment" className="rounded-xl border border-[#FF8E9C]/25 bg-[#0B1933] p-5">
    <h3 ref={heading} tabIndex={-1} className="font-semibold text-white outline-none">{support ? "Review your support payment" : "Review your revenue deposit"}</h3>
    <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2"><Field label="Attached amount" value={`${yoctoToNear(BigInt(review.amountYocto))} NEAR`} /><Field label="Campaign" value={`#${campaignId}`} /><Field label="Paying from" value={review.accountId} /><Field label="Receiving contract" value={ZINC_CONTRACT_ID} /></dl>
    <p className="mt-4 text-sm leading-6 text-[#A9B6CF]">Your testnet NEAR enters the campaign revenue pool. Current revenue-right owners and the treasury can claim their allocated shares. Funds are held by the Zinc contract until claimed.</p>
    <p className="mt-3 text-xs leading-5 text-[#71809D]">This payment does not buy an NFT, ticket, download, or other fulfillment. The contract uses ownership when the deposit executes; an ownership snapshot on this page can change before then. Gas is paid separately from the attached amount.</p>
    <div className="mt-5 flex flex-wrap gap-3"><button type="button" onClick={onBack} disabled={busy} className="rounded-xl border border-[#293954] px-4 py-3 text-sm text-[#A9B6CF] disabled:opacity-40">Back &amp; edit amount</button><button type="button" onClick={onConfirm} disabled={busy || !active} className="rounded-xl bg-gradient-to-r from-[#ff685b] to-[#ff8a9c] px-5 py-3 text-sm font-semibold text-white disabled:opacity-40">{submitting ? "Waiting for wallet / network..." : refreshing ? "Refreshing campaign..." : !active ? "Campaign not Active" : "Confirm in wallet"}</button></div>
  </section>;
}
function Field({ label, value }: { label: string; value: string }) { return <div className="min-w-0"><dt className="text-xs text-[#71809D]">{label}</dt><dd className="mt-1 break-all text-white">{value}</dd></div>; }
