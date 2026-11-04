import Link from "next/link";
import { ArrowUpRight, Fingerprint } from "lucide-react";
import type { OnChainRevenueRight } from "../../lib/zinc-contract";

export function rightHref(tokenId: string) {
  return `/rights/${encodeURIComponent(tokenId)}`;
}

type RevenueRightCardProps = {
  right: OnChainRevenueRight;
  campaignName: string;
  status?: string;
};

/** Application artwork is derived from the right's identity, not a remote NFT image. */
export default function RevenueRightCard({ right, campaignName, status }: RevenueRightCardProps) {
  const orientation = (right.campaign_id * 31 + right.contributor_index * 47) % 180;
  return (
    <Link href={rightHref(right.token_id)} aria-label={`View ${right.role} revenue right, ${right.share_bps / 100}%, ${campaignName}`}
      className="zinc-right-card group relative isolate block overflow-hidden rounded-2xl border border-[#ff9988]/25 bg-[#0b1930] p-4 text-white transition duration-200 hover:border-[#ff9988]/65 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ff9988] sm:p-5 motion-reduce:transition-none">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10" style={{ background: "radial-gradient(ellipse at 85% 38%, rgba(255,109,95,.19), transparent 65%), linear-gradient(145deg, rgba(255,141,161,.05), transparent 55%)" }} />
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-xs font-bold tracking-[0.2em]"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#ff796a] text-[#101b30]">Z</span> ZINC / RIGHTS</span>
        <ArrowUpRight size={18} className="text-[#ff9988] transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 motion-reduce:transform-none" />
      </div>
      <div className="relative my-4 flex min-h-40 items-center">
        <svg aria-hidden="true" viewBox="0 0 240 190" className="pointer-events-none absolute -right-8 top-0 h-full w-[78%] text-[#ff9988] opacity-60">
          <g transform={`translate(120 95) rotate(${orientation})`} fill="none" stroke="currentColor">
            <g className="zinc-right-orbits">{[0, 30, 60, 90, 120, 150].map((rotation) => <ellipse key={rotation} rx="76" ry="30" transform={`rotate(${rotation})`} strokeWidth="0.7" />)}</g>
            <circle r="86" strokeOpacity=".2" strokeDasharray="2 7" />
            <circle className="zinc-right-electron" r="4" fill="currentColor" stroke="none" />
          </g>
        </svg>
        <div className="relative">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#dca79f]">Future revenue share</p>
          <p className="mt-1 text-6xl font-semibold tracking-[-0.06em] tabular-nums">{right.share_bps / 100}<span className="ml-1 text-3xl text-[#ff9988]">%</span></p>
          <p className="mt-3 max-w-[15rem] break-words text-sm font-medium text-[#f6c2b9]">{right.role}</p>
        </div>
      </div>
      <div className="border-t border-[#ff9988]/15 pt-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#a3b1c6]">Revenue Right NFT · NEAR Testnet</p>
        <h3 className="mt-2 break-words text-lg font-semibold leading-snug">{campaignName}</h3>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-[#a3b1c6]">
          <span>Campaign #{right.campaign_id}</span><span aria-hidden="true">/</span><span>Right #{right.contributor_index}</span>
          {status && <span className="ml-auto rounded-full border border-[#ff9988]/25 px-2 py-1 text-[#ffd1c6]">{status}</span>}
        </div>
      </div>
      <div className="mt-4 flex items-start gap-2 border-t border-white/5 pt-3">
        <Fingerprint size={14} className="mt-0.5 shrink-0 text-[#8194ae]" />
        <div className="min-w-0"><p className="text-[10px] uppercase tracking-wider text-[#8194ae]">Current owner</p><p className="mt-1 break-all font-mono text-[11px] leading-4 text-[#b9c6d8]">{right.owner_id}</p></div>
      </div>
    </Link>
  );
}
