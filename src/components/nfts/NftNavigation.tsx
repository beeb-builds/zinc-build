import Link from "next/link";

export default function NftNavigation({ active }: { active: "owned" | "public" }) {
  return <nav aria-label="NFT collections" className="mb-5 flex flex-wrap gap-3">{[{ href: "/nfts", label: "My owned NFTs", id: "owned" }, { href: "/gallery", label: "Public NFT gallery", id: "public" }].map(({ href, label, id }) => <Link key={href} href={href} aria-current={active === id ? "page" : undefined} className={`rounded-xl border px-4 py-3 text-sm font-semibold ${active === id ? "border-[#ff9988]/30 bg-[#ff9988]/10 text-[#ff9988]" : "border-white/10 text-[#aebbd0]"}`}>{label}</Link>)}</nav>;
}
