"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState, type ReactNode } from "react";
import {
  ArrowLeftRight,
  DollarSign,
  Folder,
  LayoutDashboard,
  LogOut,
  Settings,
  Wallet,
} from "lucide-react";

import { useWallet } from "../wallet/WalletProvider";
import TransactionRecovery from "../transactions/TransactionRecovery";
import NavigationPending from "./NavigationPending";
import ScrollMotion from "./ScrollMotion";

type DashboardShellProps = {
  children: ReactNode;
  title: string;
  subtitle: string;
  headerActions?: ReactNode;
};

const navigation = [
  {
    name: "Overview",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    name: "Campaigns",
    href: "/campaigns",
    icon: Folder,
  },
  {
    name: "My NFTs",
    href: "/nfts",
    icon: Wallet,
  },
  {
    name: "Earnings",
    href: "/earnings",
    icon: DollarSign,
  },
  {
    name: "Transactions",
    href: "/transactions",
    icon: ArrowLeftRight,
  },
  {
    name: "Settings",
    href: "/settings",
    icon: Settings,
  },
];

function shortenAccountId(accountId: string) {
  if (accountId.length <= 24) {
    return accountId;
  }

  return `${accountId.slice(0, 10)}...${accountId.slice(-8)}`;
}

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/nfts" && (pathname === "/rights" || pathname.startsWith("/rights/"))) return true;
  if (href === "/campaigns" && pathname.startsWith("/workspace/")) return true;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function DashboardShell({
  children,
  title,
  subtitle,
  headerActions,
}: DashboardShellProps) {
  const pathname = usePathname();
  const [disconnecting, setDisconnecting] = useState(false);
  const [disconnectError, setDisconnectError] = useState(false);
  const disconnectLocked = useRef(false);

  const {
    accountId,
    connect,
    disconnect,
    isInitializing,
    isConnecting,
  } = useWallet();

  async function disconnectWallet() {
    if (disconnectLocked.current) return;
    disconnectLocked.current = true;
    setDisconnecting(true);
    setDisconnectError(false);
    try { await disconnect(); }
    catch { setDisconnectError(true); }
    finally { disconnectLocked.current = false; setDisconnecting(false); }
  }

  return (
    <div className="min-h-screen bg-[#07142d] text-white">
      <div aria-hidden="true" className="zinc-scroll-progress" />
      <a href="#zinc-content" className="fixed left-4 top-3 z-[100] -translate-y-24 rounded-xl bg-[#ff8a9c] px-4 py-3 text-sm font-semibold text-[#07142d] focus:translate-y-0">Skip to page content</a>
      <aside className="fixed inset-y-0 left-0 z-50 hidden w-[76px] flex-col items-center border-r border-white/[0.06] bg-[#08172f] py-5 md:flex">
        <Link
          href="/"
          aria-label="Zinc home"
          className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#ff675a] to-[#ff8b9d] text-lg font-bold text-white shadow-lg shadow-[#ff675a]/20"
        >
          Z
        </Link>

        <nav aria-label="Main navigation" className="mt-10 flex flex-1 flex-col items-center gap-3 overflow-y-auto py-1">
          {navigation.map(({ name, href, icon: Icon }) => {
            const active = isActive(pathname, href);

            return (
              <Link
                key={name}
                href={href}
                title={name}
                aria-label={name}
                aria-current={active ? pathname === href ? "page" : "location" : undefined}
                className={`group relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff8a9c] motion-reduce:transition-none ${
                  active
                    ? "bg-[#ff6b5f] text-white shadow-lg shadow-[#ff6b5f]/20"
                    : "text-[#617692] hover:bg-[#112441] hover:text-white"
                }`}
              >
                <Icon size={19} aria-hidden="true" />
                <NavigationPending label={name} />

                <span aria-hidden="true" className="pointer-events-none fixed left-[70px] z-50 hidden whitespace-nowrap rounded-lg bg-[#162944] px-3 py-2 text-xs text-white shadow-xl group-hover:block group-focus-visible:block">
                  {name}
                </span>
              </Link>
            );
          })}
        </nav>

        <span className="mt-5 text-[9px] font-semibold uppercase tracking-widest text-[#8da0ba]">Testnet</span>
      </aside>

      <div className="min-h-screen min-w-0 pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0 md:pl-[76px]">
        <header className="border-b border-white/[0.05] px-4 py-4 sm:px-5 md:px-8 md:py-5 xl:px-10">
          <div className="mx-auto flex min-w-0 max-w-[1600px] flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-3 md:gap-4">
              <Link href="/" aria-label="Zinc home" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#ff675a] to-[#ff8b9d] font-bold md:hidden">
                Z
              </Link>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="break-words text-lg font-semibold tracking-tight sm:text-xl md:text-2xl">
                    {title}
                  </h1>

                  <span className="rounded-full border border-[#ff715f]/20 bg-[#ff715f]/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#ff8a7e]">
                    Testnet
                  </span>
                </div>

                <p className="mt-1 text-xs leading-5 text-[#8fa0bc] sm:text-sm">
                  {subtitle}
                </p>
              </div>
            </div>

            <div className="zinc-header-actions flex min-w-0 flex-wrap items-center gap-2 sm:gap-3">
            {headerActions}
            {accountId ? (
              <div className="flex min-w-0 max-w-full items-center gap-2">
                <div className="flex min-w-0 items-center gap-2 rounded-xl border border-white/[0.08] bg-[#112441] px-3 py-3 sm:px-4">
                  <div className="h-2 w-2 rounded-full bg-emerald-400" />

                  <Wallet
                    size={16}
                    className="text-[#ff8a9c]"
                  />

                  <span
                    className="truncate text-xs font-semibold text-white sm:text-sm"
                    title={accountId}
                  >
                    {shortenAccountId(accountId)}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={disconnectWallet}
                  disabled={disconnecting}
                  aria-label={disconnecting ? "Disconnecting wallet" : "Disconnect wallet"}
                  title="Disconnect wallet"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-[#112441] text-[#8da0ba] transition hover:border-[#ff685b]/30 hover:text-[#ff8a9c] disabled:opacity-40"
                >
                  <LogOut size={17} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={connect}
                disabled={isConnecting}
                aria-busy={isInitializing || isConnecting}
                className="flex w-fit items-center gap-2 rounded-xl bg-gradient-to-r from-[#ff685b] to-[#ff8a9c] px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-[#ff685b]/15 transition hover:opacity-90"
              >
                <Wallet size={17} />
                {isConnecting ? "Opening wallet when ready..." : isInitializing ? "Preparing wallet..." : "Connect Wallet"}
              </button>
            )}
            </div>
          </div>
        </header>

        <nav aria-label="Mobile navigation" className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-6 gap-0.5 border-t border-white/[0.09] bg-[#08172f]/95 px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-[0_-12px_32px_rgba(0,0,0,0.18)] backdrop-blur-xl md:hidden">
          {navigation.map(({ name, href, icon: Icon }) => {
            const active = isActive(pathname, href);
            return <Link key={href} href={href} aria-label={name} aria-current={active ? pathname === href ? "page" : "location" : undefined}
              className={`relative flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-0.5 py-2 text-[9px] font-medium transition sm:text-[11px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff8a9c] motion-reduce:transition-none ${active ? "bg-[#ff6b5f]/15 text-[#ff9a8e]" : "text-[#a1b1c9] hover:bg-[#112441] hover:text-white"}`}>
              <Icon size={18} aria-hidden="true" /><span>{name === "Transactions" ? "Activity" : name}</span>
              <NavigationPending label={name} />
            </Link>;
          })}
        </nav>

        <main id="zinc-content" tabIndex={-1} className="zinc-page-enter mx-auto min-w-0 max-w-[1600px] scroll-mt-4 px-4 py-5 outline-none sm:px-5 md:px-8 md:py-7 xl:px-10">
          <ScrollMotion route={pathname} />
          {disconnectError && <p role="alert" className="mb-4 text-sm text-[#FF8E9C]">Could not disconnect your wallet. Please try again.</p>}
          <TransactionRecovery />
          {children}
        </main>
      </div>
    </div>
  );
}
