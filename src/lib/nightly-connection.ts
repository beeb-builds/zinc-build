import type { InjectedWallet, WalletModuleFactory } from "@near-wallet-selector/core";
import { assertNightlySession, bindNightlyProvider, nightlySessionIssue, nightlySigningError, restoreNightlySession } from "./wallet-session";

export function nightlyConnectionError(error: unknown): Error {
  const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
  if (code === 4001) return new Error("Nightly connection was cancelled. Retry when you are ready to approve it.");
  if (code === -32002) return new Error("Nightly already has a pending request. Open the extension and complete or reject that request before retrying.");
  const message = typeof error === "string" ? error : error && typeof error === "object" && "message" in error && typeof error.message === "string" ? error.message : "";
  const detail = message.trim().slice(0, 300);
  return new Error(detail
    ? `Nightly could not connect: ${detail}`
    : "Nightly did not complete the connection. Open and unlock its extension, select NEAR Testnet, then check for a pending connection request.");
}

export async function waitForNightlyProvider(timeoutMs = 8000): Promise<void> {
  const started = Date.now();
  while (typeof window !== "undefined" && !window.nightly?.near) {
    if (Date.now() - started >= timeoutMs) {
      throw new Error("Nightly's NEAR provider was not detected. Enable the Nightly extension for this site in your browser, unlock it, then reload Zinc. Installing the separate mobile app alone does not connect this browser.");
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

// Keep the official transaction/signature formats; validate its cached session.
export function withNightlyConnection(factory: WalletModuleFactory<InjectedWallet>): WalletModuleFactory<InjectedWallet> {
  return async (options) => {
    const nightlyModule = await factory(options);
    if (!nightlyModule) return null;
    return {
      ...nightlyModule,
      async init(context) {
        await waitForNightlyProvider();
        bindNightlyProvider();
        const provider = window.nightly!.near;
        let wallet;
        try { wallet = await nightlyModule.init(context); }
        catch (error) { throw nightlyConnectionError(error); }
        return {
          ...wallet,
          async signIn(params) {
            try {
              // Upstream signIn returns cached accounts even when isConnected is false.
              if (nightlySessionIssue(provider.account?.accountId ?? "")) {
                if (window.nightly?.near !== provider) throw new Error("The extension changed. Reload Zinc before reconnecting.");
                await provider.connect((account) => {
                  if (!account) context.emitter.emit("signedOut", null);
                  else context.emitter.emit("accountsChanged", { accounts: [{ accountId: account.accountId, publicKey: account.publicKey.toString() }] });
                });
                restoreNightlySession(provider.account?.accountId ?? "");
              }
              assertNightlySession(provider.account?.accountId ?? "");
              return await wallet.signIn(params);
            }
            catch (error) { throw nightlyConnectionError(error); }
          },
          async getAccounts() {
            if (nightlySessionIssue(provider.account?.accountId ?? "")) return [];
            return wallet.getAccounts();
          },
          async signAndSendTransaction(params) {
            const accountId = params.signerId ?? context.store.getState().accounts.find((account) => account.active)?.accountId ?? "";
            assertNightlySession(accountId);
            try { return await wallet.signAndSendTransaction(params); }
            catch (error) { throw nightlySigningError(error, accountId); }
          },
          async signAndSendTransactions(params) {
            const accountId = context.store.getState().accounts.find((account) => account.active)?.accountId ?? "";
            assertNightlySession(accountId);
            for (const transaction of params.transactions) if (transaction.signerId) assertNightlySession(transaction.signerId);
            try { return await wallet.signAndSendTransactions(params); }
            catch (error) { throw nightlySigningError(error, accountId); }
          },
          ...(wallet.signMessage && { async signMessage(params: Parameters<NonNullable<typeof wallet.signMessage>>[0]) {
            const accountId = context.store.getState().accounts.find((account) => account.active)?.accountId ?? "";
            assertNightlySession(accountId);
            try { return await wallet.signMessage!(params); }
            catch (error) { throw nightlySigningError(error, accountId); }
          } }),
        };
      },
    };
  };
}
