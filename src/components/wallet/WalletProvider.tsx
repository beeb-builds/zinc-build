"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { WalletSelector } from "@near-wallet-selector/core";
import type { WalletSelectorModal } from "@near-wallet-selector/modal-ui";
import { ZINC_CONTRACT_ID } from "../../lib/near";

type WalletSession = { selector: WalletSelector; modal: WalletSelectorModal };
let session: Promise<WalletSession> | null = null;
function initializeWallet() {
  if (!session) {
    session = Promise.all([import("../../lib/wallet-selector"), import("@near-wallet-selector/modal-ui")])
      .then(async ([wallets, ui]) => {
        const selector = await wallets.createWalletSelector();
        return { selector, modal: ui.setupModal(selector, { contractId: ZINC_CONTRACT_ID }) };
      }).catch((error) => { session = null; throw error; });
  }
  return session;
}

type WalletContextValue = {
  selector: WalletSelector | null;
  modal: WalletSelectorModal | null;
  accountId: string | null;
  isInitializing: boolean;
  isConnecting: boolean;
  connect: () => void;
  disconnect: () => Promise<void>;
};
const WalletContext = createContext<WalletContextValue | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [wallet, setWallet] = useState<WalletSession | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const requestedConnection = useRef(false);

  function showWallet(ready: WalletSession) {
    try { ready.modal.show(); }
    catch { setError("The wallet selector could not open. Please try Connect Wallet again."); }
  }

  useEffect(() => {
    let cancelled = false;
    let subscription: { unsubscribe: () => void } | undefined;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Reflect startup/retry of the external Wallet Selector session, including Strict Mode cancellation.
    setIsInitializing(true);
    setError(null);
    initializeWallet().then((ready) => {
      if (cancelled) return;
      const update = () => setAccountId(ready.selector.store.getState().accounts.find((account) => account.active)?.accountId ?? null);
      update();
      subscription = ready.selector.store.observable.subscribe(update);
      setWallet(ready);
      if (requestedConnection.current) {
        requestedConnection.current = false;
        showWallet(ready);
      }
      setIsConnecting(false);
      setIsInitializing(false);
    }).catch(() => {
      if (!cancelled) {
        requestedConnection.current = false;
        setIsConnecting(false);
        setIsInitializing(false);
        setError("Wallet connection could not initialize. You can keep browsing or retry below.");
      }
    });
    return () => { cancelled = true; subscription?.unsubscribe(); };
  }, [attempt]);

  function connect() {
    setError(null);
    if (wallet) { showWallet(wallet); return; }
    requestedConnection.current = true;
    setIsConnecting(true);
    if (error) setAttempt((value) => value + 1);
  }
  async function disconnect() {
    if (!wallet) return;
    try {
      const connected = await wallet.selector.wallet();
      await connected.signOut();
      setAccountId(null);
      setError(null);
    } catch {
      const message = "Your wallet could not disconnect. Please try Disconnect Wallet again.";
      setError(message);
      throw new Error(message);
    }
  }

  return <WalletContext.Provider value={{ selector: wallet?.selector ?? null, modal: wallet?.modal ?? null, accountId, isInitializing, isConnecting, connect, disconnect }}>
    {error && <div role="alert" className="relative z-[60] border-b border-[#FF8E9C]/25 bg-[#122344] px-5 py-3 text-sm text-[#FF8E9C] md:pl-24">
      {error} {!wallet && <button type="button" onClick={() => setAttempt((value) => value + 1)} className="ml-3 underline">Retry wallet connection</button>}
    </div>}
    {children}
  </WalletContext.Provider>;
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) throw new Error("useWallet must be used inside WalletProvider");
  return context;
}
