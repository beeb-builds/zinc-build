"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { invalidateReadCache, isBrowserWriteActive } from "../../lib/read-scheduler";

/** Read-only refresh: never interrupt a wallet submission or offer to resend it. */
export default function CampaignRefreshButton({ retry = false }: { retry?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [blocked, setBlocked] = useState(false);
  function refresh() {
    if (pending) return;
    if (isBrowserWriteActive()) { setBlocked(true); return; }
    setBlocked(false);
    startTransition(() => {
      invalidateReadCache();
      router.refresh();
    });
  }
  return <div className="text-left">
    <button type="button" onClick={refresh} disabled={pending} aria-busy={pending} className="rounded-xl border border-[#293954] px-4 py-2 text-sm font-medium text-[#A9B6CF] transition hover:text-white disabled:opacity-40">{pending ? "Refreshing campaign..." : retry ? "Retry campaign read" : "Refresh campaign data"}</button>
    {pending && <p role="status" className="mt-2 text-xs text-[#71809D]">Reading campaign data from NEAR Testnet. No transaction is submitted.</p>}
    {blocked && <p role="status" className="mt-2 max-w-sm text-xs leading-5 text-[#FF8E9C]">Finish the current wallet transaction before refreshing. If its result is uncertain, check Transaction recovery.</p>}
  </div>;
}
