"use client";

import Link from "next/link";
import { useTransition } from "react";

/** Keep recovery independent of the failed page and dashboard components. */
export default function PageError({ retry }: { error: unknown; retry: () => void }) {
  const [retrying, startTransition] = useTransition();
  return <main className="flex min-h-screen items-center justify-center bg-[#07142d] px-5 py-12 text-white">
    <section aria-labelledby="page-error-heading" className="w-full max-w-xl rounded-[28px] border border-[#293954] bg-[#10213d] p-6 md:p-8">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#ff8a9c]">Zinc / NEAR Testnet</p>
      <h1 id="page-error-heading" className="mt-3 text-2xl font-semibold">This page couldn&apos;t be displayed</h1>
      <p role="alert" className="mt-4 text-sm leading-6 text-[#A9B6CF]">An unexpected page error occurred. Try loading the page again or return to the overview.</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <button type="button" disabled={retrying} onClick={() => startTransition(() => retry())} className="rounded-xl bg-gradient-to-r from-[#ff685b] to-[#ff8a9c] px-4 py-3 text-sm font-semibold disabled:opacity-40">{retrying ? "Loading page..." : "Try loading again"}</button>
        <Link href="/" className="rounded-xl border border-[#293954] px-4 py-3 text-sm text-[#A9B6CF]">Back to overview</Link>
      </div>
      {retrying && <p role="status" className="mt-3 text-xs text-[#A9B6CF]">Re-fetching and opening this page...</p>}
      <div className="mt-6 rounded-xl border border-[#ff8a9c]/20 bg-[#0b1b34] p-4">
        <h2 className="text-sm font-semibold text-[#ff8a9c]">Were you signing a transaction?</h2>
        <p className="mt-2 text-xs leading-5 text-[#A9B6CF]">A page error does not tell us whether your transaction succeeded. Check your wallet activity and Transaction recovery before submitting it again. Loading this page again does not resend a transaction.</p>
        <Link href="/transactions" className="mt-3 inline-flex text-sm text-[#ff8a9c]">Open activity &amp; transaction recovery</Link>
      </div>
    </section>
  </main>;
}
