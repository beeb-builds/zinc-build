"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { WalletSelector } from "@near-wallet-selector/core";
import type { WalletSelectorModal } from "@near-wallet-selector/modal-ui";
import { ZINC_CONTRACT_ID } from "../../lib/near";
import { nightlySessionIssue, WALLET_SESSION_CHANGED } from "../../lib/wallet-session";

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
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const requestedConnection = useRef(false);
  const reconnectLocked = useRef(false);

  async function reconnectNightly(ready: WalletSession) {
    if (reconnectLocked.current) return;
    reconnectLocked.current = true;
    setIsConnecting(true);
    try {
      const connected = await ready.selector.wallet("nightly");
      if (connected.type !== "injected") throw new Error("Nightly's extension is unavailable. Reload Zinc before reconnecting.");
      if (ready.selector.store.getState().selectedWalletId !== "nightly") throw new Error("Your selected wallet changed. Use Connect Wallet again.");
      await connected.signIn({ contractId: ZINC_CONTRACT_ID });
      setError(null);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Nightly could not reconnect. Unlock the extension, then try Reconnect wallet again.");
    } finally { reconnectLocked.current = false; setIsConnecting(false); }
  }

  function showWallet(ready: WalletSession) {
    const current = ready.selector.store.getState();
    if (current.selectedWalletId === "nightly" && nightlySessionIssue(current.accounts.find((account) => account.active)?.accountId ?? "")) {
      // The modal treats the selected wallet as already connected and skips
      // signIn. Reconnect explicitly only in response to this user action.
      void reconnectNightly(ready);
      return;
    }
    try { ready.modal.show(); }
    catch { setError("The wallet selector could not open. Please try Connect Wallet again."); }
  }

  useEffect(() => {
    let cancelled = false;
    let subscription: { unsubscribe: () => void } | undefined;
    let stopSessionChecks: (() => void) | undefined;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Reflect startup/retry of the external Wallet Selector session, including Strict Mode cancellation.
    setIsInitializing(true);
    setError(null);
    initializeWallet().then((ready) => {
      if (cancelled) return;
      const update = () => {
        if (cancelled) return;
        const current = ready.selector.store.getState();
        const id = current.accounts.find((account) => account.active)?.accountId ?? null;
        const issue = id && current.selectedWalletId === "nightly" ? nightlySessionIssue(id) : null;
        setSessionError(issue);
        setAccountId(issue ? null : id);
      };
      update();
      subscription = ready.selector.store.observable.subscribe(update);
      const visibleUpdate = () => { if (document.visibilityState === "visible") update(); };
      window.addEventListener("focus", update);
      window.addEventListener("pageshow", update);
      window.addEventListener("storage", update);
      window.addEventListener(WALLET_SESSION_CHANGED, update);
      document.addEventListener("visibilitychange", visibleUpdate);
      // Some extension disconnects do not emit accountsChanged. This reads local
      // booleans only; no RPC, reconnect, or wallet prompt is started by the timer.
      const timer = window.setInterval(visibleUpdate, 10_000);
      stopSessionChecks = () => {
        window.clearInterval(timer);
        window.removeEventListener("focus", update);
        window.removeEventListener("pageshow", update);
        window.removeEventListener("storage", update);
        window.removeEventListener(WALLET_SESSION_CHANGED, update);
        document.removeEventListener("visibilitychange", visibleUpdate);
      };
      setWallet(ready);
      setIsConnecting(false);
      if (requestedConnection.current) {
        requestedConnection.current = false;
        showWallet(ready);
      }
      setIsInitializing(false);
    }).catch(() => {
      if (!cancelled) {
        requestedConnection.current = false;
        setIsConnecting(false);
        setIsInitializing(false);
        setError("Wallet connection could not initialize. You can keep browsing or retry below.");
      }
    });
    return () => { cancelled = true; subscription?.unsubscribe(); stopSessionChecks?.(); };
  // showWallet/reconnectNightly use only stable state setters and refs; changing
  // render-local function identities must not restart the external subscription.
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
    {sessionError && <div role="alert" className="relative z-[60] border-b border-[#FF8E9C]/25 bg-[#122344] px-5 py-3 text-sm text-[#FF8E9C] md:pl-24">
      {sessionError} <button type="button" onClick={connect} disabled={isConnecting} className="ml-3 underline disabled:opacity-40">{isConnecting ? "Reconnecting Nightly..." : "Reconnect wallet"}</button>
    </div>}
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
