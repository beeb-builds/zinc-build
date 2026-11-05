import type { WalletSelector } from "@near-wallet-selector/core";

export const WALLET_SESSION_CHANGED = "zinc-wallet-session-changed";
const invalidatedAccounts = new Set<string>();
let boundProvider: NonNullable<Window["nightly"]>["near"] | undefined;

export class WalletSessionError extends Error {
  readonly code = "ZINC_WALLET_NOT_SUBMITTED";
}

export function bindNightlyProvider() {
  boundProvider = window.nightly?.near;
}

export function notifyWalletSession() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(WALLET_SESSION_CHANGED));
}

/** Local provider state only: never connects, signs, or performs an RPC read. */
export function nightlySessionIssue(accountId: string): string | null {
  const provider = typeof window !== "undefined" ? window.nightly?.near : undefined;
  if (!provider) return "Nightly's NEAR provider is unavailable. Enable and unlock the extension, then reload Zinc.";
  if (boundProvider && provider !== boundProvider) return "Nightly's extension session changed. Reload Zinc, then connect your wallet again.";
  if (provider.isConnected !== true || invalidatedAccounts.has(accountId)) return "Nightly is disconnected. Use Connect Wallet to reconnect before signing.";
  if (!accountId || provider.account?.accountId !== accountId) return "Nightly's account changed. Reconnect the intended wallet before signing.";
  return null;
}

export function restoreNightlySession(accountId: string) {
  invalidatedAccounts.delete(accountId);
  notifyWalletSession();
}

export function assertNightlySession(accountId: string) {
  const issue = nightlySessionIssue(accountId);
  if (issue) {
    notifyWalletSession();
    throw new WalletSessionError(`${issue} No signing request was sent.`);
  }
}

export function assertWalletSession(selector: WalletSelector, accountId: string) {
  if (selector.store.getState().selectedWalletId === "nightly") assertNightlySession(accountId);
}

/** Once signing was invoked, a connection error alone cannot prove no broadcast. */
export function nightlySigningError(error: unknown, accountId: string): unknown {
  const message = typeof error === "string" ? error : error instanceof Error ? error.message
    : error && typeof error === "object" && "message" in error ? String(error.message) : "";
  if (/^(?:not connected|wallet not signed in|wallet (?:is )?not connected|disconnected)[.!]?$/i.test(message.trim()) || nightlySessionIssue(accountId)) {
    invalidatedAccounts.add(accountId);
    notifyWalletSession();
    return new Error("Nightly lost its connection during the request. Reconnect your wallet, then check Transaction recovery and wallet activity before retrying. No successful result was verified.");
  }
  return error;
}
