import Link from "next/link";
import { yoctoToNear } from "near-api-js";
import type { DashboardClaim } from "../../lib/dashboard-claims";
import type { OnChainCampaign } from "../../lib/zinc-contract";

type Props = { accountId: string | null; claims: DashboardClaim[] | null; claimsFailed: boolean; campaignFailed: boolean; campaignsReady: boolean; activeCampaign: OnChainCampaign | null; onConnect: () => void };
export default function DashboardActions({ accountId, claims, claimsFailed, campaignFailed, campaignsReady, activeCampaign, onConnect }: Props) {
  return <section aria-label="Your next steps in Zinc" className="mb-5 grid gap-5 lg:grid-cols-[1.1fr_1fr]">
    <div className="min-w-0 rounded-[26px] border border-[#ff9988]/20 bg-gradient-to-br from-[#142947] to-[#0f213d] p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#FF8E9C]">Revenue agreements that earn</p>
      <h3 className="mt-3 text-2xl font-semibold tracking-tight text-white">A project creates the agreement.<br />Its contributors receive the NFTs.</h3>
      <p className="mt-4 text-sm leading-6 text-[#A9B6CF]">Each contributor NFT controls a share of future campaign deposits. When it moves, future revenue follows its new owner; revenue already earned remains with the previous owner.</p>
      <div className="mt-5 flex flex-wrap gap-3">
        {!accountId ? <button type="button" onClick={onConnect} className="rounded-xl bg-gradient-to-r from-[#ff685b] to-[#ff8a9c] px-4 py-3 text-sm font-semibold text-white">Connect wallet to find your rights</button> : <Link href="/nfts" className="rounded-xl bg-gradient-to-r from-[#ff685b] to-[#ff8a9c] px-4 py-3 text-sm font-semibold text-white">Inspect NFTs owned by your wallet ↗</Link>}
        <Link href="/campaigns" className="rounded-xl border border-[#293954] px-4 py-3 text-sm text-[#A9B6CF]">Explore campaign agreements ↗</Link>
      </div>
      <p className="mt-4 text-xs leading-5 text-[#71809D]">The NFT supply below is platform-wide, not a count of NFTs in your wallet. Treasury shares stay account-based.</p>
      <div className="mt-5 border-t border-[#293954] pt-4">
        <p className="text-xs font-semibold text-[#A9B6CF]">Want to support a project?</p>
        {activeCampaign ? <Link href={`/pay/${activeCampaign.id}`} className="mt-2 block break-words text-sm text-[#FF8E9C]">Support {activeCampaign.name} · Campaign #{activeCampaign.id} ↗</Link>
          : <p className="mt-2 text-xs text-[#71809D]">{campaignFailed ? "Campaign availability could not be loaded. Explore campaigns to retry." : campaignsReady ? "No campaign is currently accepting revenue deposits." : "Reading active campaign availability..."}</p>}
        <p className="mt-2 text-xs leading-5 text-[#71809D]">Support funds the campaign. It does not buy an NFT, and revenue depends on actual deposits.</p>
      </div>
    </div>
    <div className="min-w-0 rounded-[26px] border border-white/[0.06] bg-[#10213d] p-6">
      <h3 className="text-lg font-semibold text-white">Your next revenue action</h3>
      {!accountId ? <><p className="mt-4 text-sm leading-6 text-[#A9B6CF]">Connect a wallet to find claimable revenue across campaigns, including earnings retained after an NFT transfer. Public campaigns and NFT details can be explored without connecting.</p><Link href="/campaigns/new" className="mt-5 inline-flex text-sm text-[#FF8E9C]">Create a contributor agreement ↗</Link></>
        : <>
          <p className="mt-3 break-all text-xs text-[#71809D]">Connected account: {accountId}</p>
          {claimsFailed || campaignFailed ? <p role="status" className="mt-4 text-sm leading-6 text-[#FF8E9C]">Claim availability could not be loaded. Your balance is unknown, not zero. Use Refresh data or open Earnings to retry.</p>
            : claims === null ? <p role="status" className="mt-4 text-sm text-[#A9B6CF]">Reading your claimable campaign balances...</p>
            : claims.length === 0 ? <><p className="mt-4 text-sm text-[#A9B6CF]">No revenue is available to claim in this account&apos;s current balance snapshot.</p><p className="mt-3 text-xs leading-5 text-[#71809D]">This does not mean you own no NFTs. Current rights earn when new revenue is deposited; past claims remain visible in Earnings.</p></>
            : <><p className="mt-4 text-sm text-[#A9B6CF]">{claims.length} {claims.length === 1 ? "campaign has" : "campaigns have"} revenue ready for this account. Largest available balances first.</p><div className="mt-4 space-y-3">{claims.slice(0, 3).map((claim) => <Link key={claim.campaignId} href={`/campaigns/${claim.campaignId}#claim-revenue`} className="block rounded-xl border border-[#69dab8]/20 bg-[#153c39]/30 p-4 hover:border-[#69dab8]/40"><p className="break-words text-sm font-semibold text-white">{claim.campaignName} · #{claim.campaignId}</p><p className="mt-2 break-all text-lg font-semibold text-[#69dab8]">{yoctoToNear(BigInt(claim.amountYocto))} NEAR</p><p className="mt-2 text-xs text-[#91b9ae]">Open campaign to review &amp; claim ↗</p></Link>)}</div><p className="mt-3 text-xs leading-5 text-[#71809D]">These are campaign/account balances, including retained historical or treasury revenue. They are not individual NFT payouts. Claiming still requires your wallet signature.</p></>}
          <Link href="/earnings" className="mt-5 inline-flex text-sm font-semibold text-[#FF8E9C]">View all earnings &amp; ownership relationships ↗</Link>
        </>}
    </div>
  </section>;
}
