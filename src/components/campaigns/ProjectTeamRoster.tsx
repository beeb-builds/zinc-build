import Link from "next/link";
import type { OnChainCampaign, OnChainRevenueRight } from "../../lib/zinc-contract";
import { rightHref } from "../nfts/RevenueRightCard";

type Props = { campaign: OnChainCampaign; rights: OnChainRevenueRight[] | null; accountId: string | null };
export default function ProjectTeamRoster({ campaign, rights, accountId }: Props) {
  const account = (value: string) => <span className="break-all">{value}{accountId === value && <span className="ml-2 rounded-full bg-[#153c39] px-2 py-1 text-[10px] text-[#69dab8]">You</span>}</span>;
  return <div id="project-team" className="mt-6 scroll-mt-6">
    <h3 className="text-lg font-semibold text-white">Project team &amp; right holders</h3>
    <p className="mt-3 text-sm leading-6 text-[#A9B6CF]">The creator defines the agreement. Original contributors show who received each right at creation; current holders control future revenue. A transfer changes the holder, not the record of who contributed.</p>
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      <div className="min-w-0 rounded-xl border border-[#293954] bg-[#0b1b34] p-4"><p className="text-xs font-semibold text-[#ff9988]">Project creator</p><p className="mt-3 text-sm text-white">{account(campaign.creator)}</p><p className="mt-3 text-xs leading-5 text-[#8fa0bc]">Created the campaign and manages its private brief. Creator status alone does not grant a revenue share.</p></div>
      <div className="min-w-0 rounded-xl border border-[#293954] bg-[#0b1b34] p-4"><p className="text-xs font-semibold text-[#ff9988]">Treasury · {campaign.treasury_share_bps / 100}% account-based</p><p className="mt-3 text-sm text-white">{account(campaign.treasury_account)}</p><p className="mt-3 text-xs leading-5 text-[#8fa0bc]">This treasury allocation has no NFT. A separate contributor allocation to the same account can have its own NFT.</p></div>
    </div>
    <div className="mt-4 space-y-3">{campaign.contributors.map((contributor, index) => {
      const right = rights?.find((item) => item.contributor_index === index);
      return <div key={index} className="min-w-0 rounded-xl border border-[#293954] bg-[#0b1b34] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3"><h4 className="break-words font-semibold text-white">{contributor.role}</h4><span className="rounded-full border border-[#ff9988]/25 px-3 py-1 text-xs text-[#ff9988]">{contributor.share_bps / 100}% Revenue Right</span></div>
        <dl className="mt-4 grid min-w-0 gap-4 md:grid-cols-2"><div className="min-w-0"><dt className="text-xs text-[#8fa0bc]">Original contributor</dt><dd className="mt-2 text-sm text-[#aebbd0]">{account(contributor.account_id)}</dd></div><div className="min-w-0"><dt className="text-xs text-[#8fa0bc]">Current right holder</dt><dd className="mt-2 text-sm text-[#aebbd0]">{right ? account(right.owner_id) : "Ownership not yet verified"}</dd></div></dl>
        {right && <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-[#8fa0bc]">{right.owner_id === contributor.account_id ? "Currently held by the original contributor" : "Transferred · future revenue follows the current holder"}</p><Link href={rightHref(right.token_id)} className="break-all text-xs font-semibold text-[#ff9988]">Open NFT · {right.token_id} ↗</Link></div>}
      </div>;
    })}</div>
  </div>;
}
