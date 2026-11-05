import Link from "next/link";
import { ArrowUpRight, FolderPlus, Search, WalletCards } from "lucide-react";

const paths = [
  { href: "/campaigns/new", title: "Create a project", role: "For project creators", description: "Define the team, contributor wallets and revenue shares. A confirmed campaign mints one NFT per contributor.", Icon: FolderPlus },
  { href: "/nfts", title: "View my contributor rights", role: "For contributors & holders", description: "Find NFTs owned by your account, inspect future revenue shares and manage transfers.", Icon: WalletCards },
  { href: "/campaigns", title: "Explore projects", role: "For visitors & supporters", description: "Meet project teams, inspect their NFTs and review deposited revenue before supporting a project.", Icon: Search },
];

export default function ProjectOnboarding() {
  return <section aria-label="Get started with Zinc" className="mb-6">
    <div className="mb-4"><h2 className="text-xl font-semibold">What brings you to Zinc?</h2><p className="mt-2 text-sm leading-6 text-[#aebbd0]">Choose a starting point. One account can create a project, contribute to another, and hold rights in both. Connecting a wallet alone does not mint an NFT.</p></div>
    <div className="grid gap-4 lg:grid-cols-3">{paths.map(({ href, title, role, description, Icon }) => <Link key={href} href={href} aria-label={title} className="zinc-interactive-surface rounded-[24px] border border-white/[0.08] bg-[#10213d] p-5">
      <div className="flex items-center justify-between"><Icon size={23} className="text-[#ff9988]" /><ArrowUpRight size={18} className="text-[#8fa0bc]" /></div><p className="mt-5 text-xs text-[#8fa0bc]">{role}</p><h3 className="mt-2 text-lg font-semibold text-white">{title}</h3><p className="mt-3 text-sm leading-6 text-[#aebbd0]">{description}</p>
    </Link>)}</div>
    <Link href="/gallery" className="mt-4 inline-flex text-sm font-semibold text-[#ff9988]">See the public NFT gallery (no wallet required) ↗</Link>
  </section>;
}
