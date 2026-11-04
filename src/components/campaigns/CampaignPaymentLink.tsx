"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight, Copy } from "lucide-react";

export default function CampaignPaymentLink({ campaignId }: { campaignId: number }) {
  const [message, setMessage] = useState<string | null>(null);
  const [manualUrl, setManualUrl] = useState<string | null>(null);
  const path = `/pay/${campaignId}`;
  async function copyLink() {
    const url = new URL(path, window.location.origin).href;
    try { await navigator.clipboard.writeText(url); setMessage("Support link copied."); setManualUrl(null); }
    catch { setManualUrl(url); setMessage("Select and copy the support link below."); }
  }
  return <section className="rounded-2xl border border-[#FF8E9C]/20 bg-[#122344] p-6 md:p-8">
    <h2 className="text-xl font-semibold text-white">Receive campaign support</h2>
    <p className="mt-3 text-sm leading-6 text-[#A9B6CF]">Share a public page where supporters can pay testnet NEAR into this campaign. Payments use the same contributor and treasury split as revenue deposits.</p>
    <div className="mt-5 flex flex-wrap gap-3">
      <Link href={path} className="inline-flex items-center gap-2 rounded-xl bg-[#ff685b] px-4 py-3 text-sm font-semibold text-white">Open support page <ArrowUpRight size={16} /></Link>
      <button type="button" onClick={copyLink} className="inline-flex items-center gap-2 rounded-xl border border-[#293954] px-4 py-3 text-sm text-[#FF8E9C]"><Copy size={15} /> Copy support link</button>
    </div>
    {message && <p role="status" className="mt-3 text-sm text-[#A9B6CF]">{message}</p>}
    {manualUrl && <label className="mt-3 block"><span className="text-xs text-[#A9B6CF]">Public support link</span><input readOnly value={manualUrl} onFocus={(event) => event.currentTarget.select()} className="mt-2 w-full rounded-lg border border-[#293954] bg-[#0B1933] px-3 py-2 text-sm text-white" /></label>}
  </section>;
}
