"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useWallet } from "../wallet/WalletProvider";
import { NEAR_NETWORK_ID, NEAR_RPC_URL, ZINC_CONTRACT_ID } from "../../lib/near";

const section = "rounded-2xl border border-[#293954] bg-[#122344] p-6 md:p-8";
const button = "rounded-xl border border-[#FF8E9C]/25 px-5 py-3 text-sm font-semibold text-[#FF8E9C] transition hover:bg-[#FF8E9C]/10 disabled:cursor-not-allowed disabled:opacity-40";
const routes = [
  { href: "/", label: "Dashboard" },
  { href: "/campaigns", label: "Campaigns" },
  { href: "/campaigns/new", label: "Create campaign" },
  { href: "/earnings", label: "Earnings" },
  { href: "/nfts", label: "My NFTs" },
  { href: "/transactions", label: "Transactions" },
];

export default function SettingsPanel() {
  const { accountId, selector, modal, connect, disconnect, isInitializing, isConnecting } = useWallet();
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const locked = useRef(false);
  const ready = Boolean(selector && modal);

  async function disconnectWallet() {
    if (locked.current) return;
    locked.current = true;
    setDisconnecting(true);
    setError(null);
    try { await disconnect(); }
    catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not disconnect your wallet. Please try again.");
    } finally {
      locked.current = false;
      setDisconnecting(false);
    }
  }

  function connectWallet() {
    setError(null);
    try { connect(); }
    catch { setError("Could not open the wallet selector. Please try again."); }
  }

  return <div className="space-y-6">
    <section className={section}>
      <h2 className="text-xl font-semibold text-white">Wallet connection</h2>
      <dl className="mt-5 grid gap-5 sm:grid-cols-2">
        <Field label="Connected wallet account" value={accountId ?? (isInitializing ? "Checking saved wallet session..." : "No wallet connected")} />
        <Field label="Connection status" value={accountId ? "Connected" : isInitializing ? "Initializing wallet connection..." : ready ? "Disconnected" : "Wallet initialization unavailable. Retry connection"} />
      </dl>
      <div className="mt-6">
        {accountId ? <button type="button" onClick={disconnectWallet} disabled={disconnecting || !selector} className={button}>{disconnecting ? "Disconnecting..." : "Disconnect Wallet"}</button>
          : <button type="button" onClick={connectWallet} disabled={isConnecting || disconnecting} aria-busy={isInitializing || isConnecting} className={button}>{isConnecting ? "Opening wallet when ready..." : isInitializing ? "Preparing wallet selector..." : ready ? "Connect Wallet" : "Retry wallet connection"}</button>}
      </div>
      {disconnecting && <p role="status" className="mt-3 text-sm text-[#A9B6CF]">Signing out of the connected wallet...</p>}
      {error && <p role="alert" className="mt-3 break-words text-sm text-[#FF8E9C]">{error}</p>}
    </section>

    <section className={section}>
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-semibold text-white">Network &amp; Contract</h2>
        <span className="rounded-full border border-[#FF8E9C]/25 bg-[#FF8E9C]/10 px-3 py-1 text-xs font-semibold text-[#FF8E9C]">Testnet</span>
      </div>
      <dl className="mt-5 grid gap-5 sm:grid-cols-2">
        <Field label="Network" value={`NEAR Testnet (${NEAR_NETWORK_ID})`} />
        <Field label="Zinc contract account" value={ZINC_CONTRACT_ID} />
        <Field label="RPC provider · application reads" value={new URL(NEAR_RPC_URL).hostname} />
        <Field label="RPC endpoint currently in use" value={NEAR_RPC_URL} />
      </dl>
      <p className="mt-5 rounded-xl border border-[#FF8E9C]/20 bg-[#FF8E9C]/5 p-4 text-sm leading-6 text-[#FF8E9C]">Zinc is running on NEAR Testnet. Deposits, claims, and network fees use testnet NEAR. Use a testnet wallet for this prototype.</p>
      <p className="mt-3 text-xs leading-5 text-[#71809D]">The endpoint above is used for Zinc contract reads. Your connected wallet manages transaction signing and submission.</p>
      {ZINC_CONTRACT_ID === "zinc-demo-2026.testnet" && <p className="mt-3 text-sm leading-6 text-[#A9B6CF]">This is the fresh demo deployment. Earlier campaigns, NFTs and balances remain on the previous contract. <a href="https://zinc-build-production.up.railway.app" target="_blank" rel="noopener noreferrer" className="text-[#FF8E9C] underline">Open the previous Zinc app for earlier claims</a>.</p>}
    </section>

    <section className={section}>
      <h2 className="text-xl font-semibold text-white">Developer / Demo Info</h2>
      <dl className="mt-5 grid gap-5 sm:grid-cols-2">
        <Field label="Smart contract account" value={ZINC_CONTRACT_ID} />
        <Field label="Current network" value={`NEAR Testnet (${NEAR_NETWORK_ID})`} />
      </dl>
      <a href={`https://testnet.nearblocks.io/address/${ZINC_CONTRACT_ID}`} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex text-sm font-semibold text-[#FF8E9C]">View contract on NEAR Blocks ↗</a>
      <nav aria-label="Zinc demo routes" className="mt-6 flex flex-wrap gap-3 border-t border-[#293954] pt-5">
        {routes.map((route) => <Link key={route.href} href={route.href} className="rounded-xl border border-[#293954] px-4 py-2 text-sm text-[#A9B6CF] transition hover:text-white">{route.label}</Link>)}
      </nav>
    </section>
    <p className="text-sm leading-6 text-[#71809D]">More user preferences will be added after the hackathon prototype.</p>
  </div>;
}

function Field({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><dt className="text-xs text-[#71809D]">{label}</dt><dd className="mt-1 break-all text-sm font-medium text-white">{value}</dd></div>;
}
