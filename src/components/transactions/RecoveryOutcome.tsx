import Link from "next/link";
import type { TransactionAttempt } from "../../lib/transaction-journal";

/** Navigation after receipt verification; never offers an automatic retry. */
export default function RecoveryOutcome({ attempt }: { attempt: TransactionAttempt }) {
  if (attempt.state !== "confirmed") return null;
  const campaignHref = attempt.campaignId !== undefined ? `/campaigns/${attempt.campaignId}` : null;
  const message = attempt.method === "create_campaign"
    ? "Your campaign creation is confirmed. Contributor NFTs can be inspected on the campaign page."
    : attempt.method === "deposit_revenue"
      ? "Your deposit is confirmed. Open the campaign to check its latest deposited total."
      : attempt.method === "claim_revenue"
        ? "Your claim and payout callback are confirmed. Open earnings to check your latest balances."
        : "Your NFT transfer is confirmed. Previously earned revenue stays with the former owner; future revenue follows the current owner.";
  return <div role="status" className="mt-3 rounded-lg border border-[#69dab8]/20 bg-[#69dab8]/5 p-3">
    <p className="text-xs leading-5 text-[#A9B6CF]">{message}</p>
    {attempt.method === "create_campaign" && !campaignHref && <p className="mt-2 text-xs leading-5 text-[#A9B6CF]">The campaign ID was not available in the return data. Check the campaign list or transaction receipt before creating another campaign.</p>}
    <div className="mt-3 flex flex-wrap gap-4 text-xs text-[#FF8E9C]">
      {campaignHref && <Link href={`${campaignHref}${attempt.method === "claim_revenue" ? "#claim-revenue" : ""}`}>View campaign{attempt.method === "claim_revenue" ? " earnings" : ""}</Link>}
      {attempt.method === "create_campaign" && !campaignHref && <Link href="/campaigns">Find your campaign</Link>}
      {(attempt.method === "claim_revenue" || attempt.method === "nft_transfer") && <Link href="/earnings">View retained earnings</Link>}
      {attempt.method === "nft_transfer" && attempt.tokenId && <Link href={`/rights/${encodeURIComponent(attempt.tokenId)}`}>Inspect current NFT ownership</Link>}
      {attempt.method === "nft_transfer" && <Link href="/nfts">View current &amp; transferred rights</Link>}
    </div>
    <p className="mt-3 text-xs leading-5 text-[#71809D]">This confirms the transaction outcome. Balances and ownership may have changed since then; the linked pages load the latest data.</p>
  </div>;
}
