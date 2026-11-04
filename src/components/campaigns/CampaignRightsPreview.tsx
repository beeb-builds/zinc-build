type Props = {
  campaignName: string;
  contributors: { id: number; role: string; wallet: string; share: number }[];
  treasuryWallet: string;
  treasuryShare: number;
  creatorAccount: string | null;
};

/** Draft artwork only. Real token identities are assigned by confirmed contract execution. */
export default function CampaignRightsPreview({ campaignName, contributors, treasuryWallet, treasuryShare, creatorAccount }: Props) {
  return <section aria-labelledby="rights-preview-heading" className="mt-8">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h3 id="rights-preview-heading" className="text-lg font-semibold text-white">The NFTs this campaign will create</h3>
      <span className="rounded-full border border-[#ff9988]/25 bg-[#ff9988]/10 px-3 py-1 text-xs font-semibold text-[#ff9988]">Draft preview · Not minted</span>
    </div>
    <p className="mt-3 text-sm leading-6 text-[#9aacbf]">After a successful transaction, each contributor receives one Revenue Right NFT at the wallet shown below. The creator does not automatically receive these NFTs: recipients are determined by the contributor rows.</p>
    <p className="mt-2 text-xs leading-5 text-[#7185a1]">{contributors.length} planned {contributors.length === 1 ? "NFT" : "NFTs"}. Token IDs and campaign ID are assigned on-chain after creation. These cards preview your agreement; they are not existing tokens.</p>
    <div className="mt-5 grid gap-4 sm:grid-cols-2">
      {contributors.map((contributor, index) => <article key={contributor.id} className="relative isolate min-w-0 overflow-hidden rounded-2xl border border-[#ff9988]/25 bg-[#0b1930] p-5">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10" style={{ background: "radial-gradient(ellipse at 90% 35%, rgba(255,109,95,.17), transparent 65%)" }} />
        <div className="flex items-center justify-between gap-3"><span className="text-xs font-bold tracking-[0.18em] text-[#ff9988]">ZINC / RIGHTS</span><span className="text-xs text-[#7185a1]">Preview {index + 1}</span></div>
        <div className="relative my-5 min-h-28">
          <svg aria-hidden="true" viewBox="0 0 160 140" className="pointer-events-none absolute -right-5 top-0 h-32 w-40 text-[#ff9988] opacity-40"><g transform={`translate(80 70) rotate(${index * 37})`} fill="none" stroke="currentColor">{[0, 30, 60, 90, 120, 150].map((rotation) => <ellipse key={rotation} rx="60" ry="23" transform={`rotate(${rotation})`} strokeWidth="0.7" />)}</g></svg>
          <p className="relative text-[10px] uppercase tracking-[0.16em] text-[#aebbd0]">Future revenue share</p>
          <p className="relative mt-2 text-5xl font-semibold tracking-tight text-white">{Number.isFinite(contributor.share) ? `${contributor.share}%` : "—"}</p>
          <p className="relative mt-3 break-words font-semibold text-[#f6c2b9]">{contributor.role.trim() || "Contributor role required"}</p>
        </div>
        <p className="break-words text-sm font-semibold text-white">{campaignName.trim() || "Untitled campaign"}</p>
        <p className="mt-2 text-[10px] uppercase tracking-[0.15em] text-[#7185a1]">Revenue Right NFT · NEAR Testnet</p>
        <div className="mt-4 border-t border-[#ff9988]/15 pt-4"><p className="text-xs text-[#7185a1]">NFT recipient{creatorAccount && contributor.wallet.trim() === creatorAccount && <span className="ml-2 text-[#69dab8]">You</span>}</p><p className="mt-2 break-all font-mono text-xs leading-5 text-[#aebbd0]">{contributor.wallet.trim() || "Recipient wallet required"}</p></div>
      </article>)}
    </div>
    <div className="mt-4 rounded-2xl border border-[#293954] bg-[#0b1b34] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><h4 className="font-semibold text-white">Project treasury</h4><span className="rounded-full border border-[#293954] px-3 py-1 text-xs text-[#9aacbf]">Account-based · No treasury NFT</span></div>
      <dl className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]"><div className="min-w-0"><dt className="text-xs text-[#7185a1]">Treasury account</dt><dd className="mt-2 break-all text-sm text-[#aebbd0]">{treasuryWallet.trim() || "Treasury wallet required"}</dd></div><div><dt className="text-xs text-[#7185a1]">Revenue share</dt><dd className="mt-2 text-xl font-semibold text-[#ff9988]">{Number.isFinite(treasuryShare) ? `${treasuryShare}%` : "—"}</dd></div></dl>
      <p className="mt-3 text-xs leading-5 text-[#7185a1]">The treasury share remains with this account. If this wallet is also listed as a contributor, it receives that contributor NFT separately.</p>
    </div>
    <div className="mt-4 rounded-2xl border border-[#69dab8]/15 bg-[#153c39]/40 p-5 text-sm leading-6 text-[#aebbd0]"><p className="font-semibold text-white">What happens when a right moves?</p><p className="mt-2">Future revenue follows the current NFT owner. Revenue earned before a transfer remains with the previous owner.</p><p className="mt-2 text-xs text-[#7185a1]">Creation does not deposit revenue or guarantee earnings. Revenue is earned from actual NEAR deposits made to the campaign during its active dates.</p></div>
  </section>;
}
