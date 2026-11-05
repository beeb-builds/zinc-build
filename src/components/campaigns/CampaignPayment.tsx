import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { yoctoToNear } from "near-api-js";
import type { OnChainCampaign, OnChainRevenueRight } from "../../lib/zinc-contract";
import { ZINC_CONTRACT_ID } from "../../lib/near";
import DepositRevenueForm from "./DepositRevenueForm";
import TransactionRecovery from "../transactions/TransactionRecovery";
import { rightHref } from "../nfts/RevenueRightCard";

function date(timestamp: number) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC" }).format(timestamp);
}

export default function CampaignPayment({ campaign, rights, initiallyActive }: { campaign: OnChainCampaign; rights: OnChainRevenueRight[] | null; initiallyActive: boolean }) {
  const totalBps = campaign.contributors.reduce((sum, contributor) => sum + contributor.share_bps, campaign.treasury_share_bps);
  return <div className="space-y-6">
    <TransactionRecovery />
    <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,.9fr)]">
      <div className="min-w-0 space-y-6">
        <section className="rounded-2xl border border-[#293954] bg-[#122344] p-6 md:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#FF8E9C]">Support the people behind the work</p>
          <h1 className="mt-4 break-words text-4xl font-semibold tracking-tight">{campaign.name}</h1>
          <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-7 text-[#A9B6CF]">{campaign.description}</p>
          <dl className="mt-6 space-y-4 border-t border-[#293954] pt-5">
            <Field label={`Campaign #${campaign.id} · Created by`} value={campaign.creator} />
            <Field label="Support window (UTC)" value={`${date(campaign.start_timestamp_ms)} to ${date(campaign.end_timestamp_ms)}`} />
            <Field label="Lifetime campaign deposits" value={`${yoctoToNear(BigInt(campaign.total_deposited_yocto))} NEAR`} />
          </dl>
          <Link href={`/campaigns/${campaign.id}`} className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-[#FF8E9C]">Inspect campaign &amp; revenue rights <ArrowUpRight size={15} /></Link>
        </section>
        <section className="rounded-2xl border border-[#293954] bg-[#122344] p-6 md:p-8">
          <h2 className="text-xl font-semibold">Where your payment goes</h2>
          <p className="mt-3 text-sm leading-6 text-[#A9B6CF]">Each payment becomes campaign revenue. Contributor shares follow the current owners of their revenue-right NFTs; the treasury share stays account-based.</p>
          <div className="mt-5 space-y-3">{campaign.contributors.map((contributor, index) => {
            const right = rights?.find((item) => item.contributor_index === index);
            return <div key={index} className="rounded-xl border border-[#293954] bg-[#0B1933] p-4">
              <div className="flex items-start justify-between gap-3"><p className="break-words text-sm font-semibold">{contributor.role}</p><p className="shrink-0 text-sm font-semibold text-[#FF8E9C]">{contributor.share_bps / 100}%</p></div>
              <p className="mt-2 break-all text-xs leading-5 text-[#A9B6CF]">{right ? `Current NFT owner: ${right.owner_id}` : "Current NFT owner unavailable. Open the right to check ownership."}</p>
              <Link href={rightHref(right?.token_id ?? `campaign:${campaign.id}:right:${index}`)} className="mt-2 inline-flex text-xs text-[#FF8E9C]">Inspect revenue-right NFT ↗</Link>
            </div>;
          })}
            <div className="rounded-xl border border-[#FF8E9C]/20 bg-[#0B1933] p-4"><div className="flex justify-between gap-3"><p className="text-sm font-semibold">Project treasury</p><p className="text-sm font-semibold text-[#FF8E9C]">{campaign.treasury_share_bps / 100}%</p></div><p className="mt-2 break-all text-xs text-[#A9B6CF]">{campaign.treasury_account} · Account-based</p></div>
          </div>
          <p className="mt-4 text-sm font-semibold text-[#FF8E9C]">Total allocation: {totalBps / 100}%</p>
          <p className="mt-4 text-xs leading-5 text-[#71809D]">Owners shown are a snapshot. Contract ownership when the payment is deposited determines who earns from it. Transfers preserve the previous owner’s already-earned revenue.</p>
        </section>
      </div>
      <div className="min-w-0 space-y-5 lg:sticky lg:top-6">
        <div className="rounded-xl border border-[#FF8E9C]/25 bg-[#FF8E9C]/5 p-4 text-sm leading-6 text-[#ffc4bd]">Testnet demonstration. Use testnet NEAR only. This is campaign support; it does not purchase a ticket, download, NFT, or other fulfillment.</div>
        <DepositRevenueForm campaignId={campaign.id} startTimestampMs={campaign.start_timestamp_ms} endTimestampMs={campaign.end_timestamp_ms} initiallyActive={initiallyActive} purpose="support" />
        <p className="break-all text-xs leading-5 text-[#71809D]">Your wallet calls the Zinc contract ({ZINC_CONTRACT_ID}). Network gas is paid separately. Revenue owners claim their shares; payment does not transfer an NFT to you.</p>
      </div>
    </div>
  </div>;
}

function Field({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><dt className="text-xs text-[#71809D]">{label}</dt><dd className="mt-1 break-words text-sm text-white [overflow-wrap:anywhere]">{value}</dd></div>;
}
