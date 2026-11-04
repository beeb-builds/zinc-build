"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { yoctoToNear } from "near-api-js";
import { useWallet } from "../wallet/WalletProvider";
import { dismissTransactionAttempt, JOURNAL_CHANGED, readTransactionAttempts, recoveryStorageUnavailable, validTransactionHash, type TransactionAttempt } from "../../lib/transaction-journal";
import RecoveryOutcome from "./RecoveryOutcome";

export default function TransactionRecovery() {
  const { accountId } = useWallet();
  return accountId ? <AccountRecovery key={accountId} accountId={accountId} /> : null;
}

function AccountRecovery({ accountId }: { accountId: string }) {
  const [attempts, setAttempts] = useState<TransactionAttempt[]>([]);
  const [storageUnavailable, setStorageUnavailable] = useState(false);
  const [returnedHash, setReturnedHash] = useState<string>();
  useEffect(() => {
    function update() {
      setAttempts(readTransactionAttempts().filter((entry) => entry.accountId === accountId));
      setStorageUnavailable(recoveryStorageUnavailable());
    }
    const hashes = new URLSearchParams(window.location.search).get("transactionHashes")?.split(",");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Hydrate a browser URL hint only; it never confirms or associates the transaction without verification.
    if (hashes?.length === 1 && validTransactionHash(hashes[0])) setReturnedHash(hashes[0]);
    update();
    window.addEventListener(JOURNAL_CHANGED, update);
    window.addEventListener("storage", update);
    return () => { window.removeEventListener(JOURNAL_CHANGED, update); window.removeEventListener("storage", update); };
  }, [accountId]);
  const unresolved = attempts.filter((entry) => entry.state === "waiting" || entry.state === "unconfirmed");
  const resolved = attempts.filter((entry) => entry.state === "confirmed" || entry.state === "failed");
  if (!attempts.length && !storageUnavailable) return null;
  return <section aria-label="Transaction recovery" className="mb-6 rounded-2xl border border-[#FF8E9C]/20 bg-[#122344] p-5">
    <h2 className="font-semibold text-white">Transaction recovery{unresolved.length ? ` · ${unresolved.length} awaiting a verified result` : ""}</h2>
    <p className="mt-2 text-xs leading-5 text-[#A9B6CF]">Saved attempts from this browser for your connected account. A wallet prompt alone does not prove submission. Check wallet activity before trying an uncertain transaction again. Zinc never resubmits from this panel.</p>
    {storageUnavailable && <p role="alert" className="mt-3 text-xs text-[#FF8E9C]">Browser storage is unavailable. Attempts are remembered only while this page stays open.</p>}
    {unresolved.map((attempt) => <RecoveryRow key={attempt.id} attempt={attempt} returnedHash={returnedHash} />)}
    {resolved.length > 0 && <details className="mt-4"><summary className="cursor-pointer text-sm text-[#A9B6CF]">Recent verified results ({resolved.length})</summary><div className="mt-3 space-y-3">{resolved.slice(0, 5).map((attempt) => <RecoveryRow key={attempt.id} attempt={attempt} />)}</div></details>}
  </section>;
}

function RecoveryRow({ attempt, returnedHash }: { attempt: TransactionAttempt; returnedHash?: string }) {
  const [hash, setHash] = useState(attempt.hash ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkedWallet, setCheckedWallet] = useState(false);
  const locked = useRef(false);
  const unresolved = attempt.state === "waiting" || attempt.state === "unconfirmed";
  const candidateHash = hash.trim() || attempt.hash || "";
  async function check(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (locked.current) return;
    locked.current = true;
    setBusy(true); setError(null);
    try {
      const { recoverTransaction } = await import("../../lib/recover-transaction");
      await recoverTransaction(attempt, candidateHash);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "The status lookup failed. This does not prove the transaction failed; check again or use the explorer.");
    } finally { locked.current = false; setBusy(false); }
  }
  return <div className="mt-4 rounded-xl border border-[#293954] bg-[#0B1933] p-4">
    <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold text-white">{attempt.kind}{attempt.campaignId !== undefined ? ` · Campaign #${attempt.campaignId}` : ""}</p><span className={`text-xs ${attempt.state === "confirmed" ? "text-[#69dab8]" : "text-[#FF8E9C]"}`}>{attempt.state === "waiting" ? "Wallet request started · result unknown" : attempt.state === "unconfirmed" ? "Not yet verified" : attempt.state === "confirmed" ? "Confirmed" : "Execution / payout failed"}</span></div>
    {attempt.tokenId && <p className="mt-2 break-all font-mono text-xs text-[#A9B6CF]">{attempt.tokenId}</p>}
    {attempt.campaignName && <p className="mt-2 break-words text-xs text-[#A9B6CF]">{attempt.campaignName}</p>}
    {attempt.amountYocto && <p className="mt-2 break-all text-xs text-[#A9B6CF]">Deposit: {yoctoToNear(BigInt(attempt.amountYocto))} NEAR</p>}
    {attempt.to && <p className="mt-2 break-all text-xs text-[#A9B6CF]">Receiver: {attempt.to}</p>}
    <p className="mt-2 text-xs text-[#71809D]">Started locally: {new Date(attempt.startedAt).toLocaleString()} · Testnet</p>
    {attempt.reason && <p className="mt-2 text-xs leading-5 text-[#A9B6CF]">{attempt.reason}</p>}
    <RecoveryOutcome attempt={attempt} />
    {unresolved && <form onSubmit={check} className="mt-3 space-y-3">
      <label className="block"><span className="text-xs text-[#A9B6CF]">Transaction hash from your wallet</span><input value={hash} onChange={(event) => { setHash(event.target.value); setError(null); }} placeholder={attempt.hash ?? "Paste the transaction hash"} disabled={busy} autoComplete="off" spellCheck={false} className="mt-2 w-full rounded-lg border border-[#293954] bg-[#07142d] px-3 py-2 font-mono text-xs text-white outline-none focus:border-[#FF8E9C]" /></label>
      <p className="text-xs leading-5 text-[#71809D]">We verify the transaction’s inputs and receipts. If you made identical requests before, check the explorer time to select the intended transaction.</p>
      {returnedHash && !attempt.hash && <button type="button" onClick={() => setHash(returnedHash)} disabled={busy} className="text-xs text-[#FF8E9C]">Use hash returned by wallet (verified before association)</button>}
      <button type="submit" disabled={busy || !candidateHash} className="block rounded-lg border border-[#FF8E9C]/25 px-3 py-2 text-xs font-semibold text-[#FF8E9C] disabled:opacity-40">{busy ? "Checking finalized receipts..." : "Check on NEAR"}</button>
    </form>}
    {busy && <p role="status" className="mt-2 text-xs text-[#A9B6CF]">Waiting for the RPC status lookup...</p>}
    {error && <p role="alert" className="mt-3 break-words text-xs text-[#FF8E9C]">{error} A lookup error does not establish failure. Inspect wallet activity before resubmitting.</p>}
    <div className="mt-3 flex flex-wrap gap-4 text-xs">
      {(attempt.hash || hash.trim()) && validTransactionHash(attempt.hash ?? hash.trim()) && <a href={`https://testnet.nearblocks.io/txns/${encodeURIComponent(attempt.hash ?? hash.trim())}`} target="_blank" rel="noopener noreferrer" className="text-[#FF8E9C]">Inspect transaction ↗</a>}
      {!unresolved && <button type="button" onClick={() => window.location.reload()} className="text-[#FF8E9C]">Reload balances &amp; ownership</button>}
    </div>
    {unresolved && <label className="mt-4 flex items-start gap-2 text-xs leading-5 text-[#A9B6CF]"><input type="checkbox" checked={checkedWallet} onChange={(event) => setCheckedWallet(event.target.checked)} disabled={busy} className="mt-1 accent-[#ff7568]" />I checked wallet activity and want to remove this local reminder. This will not cancel an on-chain transaction.</label>}
    <button type="button" onClick={() => dismissTransactionAttempt(attempt.id)} disabled={busy || (unresolved && !checkedWallet)} className="mt-3 text-xs text-[#A9B6CF] underline disabled:opacity-40">Dismiss local record</button>
  </div>;
}
