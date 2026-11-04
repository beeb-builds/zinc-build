"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ACTIVITY_CHANGED, getSharedActivity } from "../../lib/zinc-activity";
import { rightOwnershipEvents, type RightOwnershipEvent } from "../../lib/right-history";

type Status = "loading" | "ready" | "error";
type Props = { tokenId: string; campaignId: number; originalOwner: string; currentOwner: string; accountId: string | null };

export default function RightOwnershipHistory(props: Props) {
  const [events, setEvents] = useState<RightOwnershipEvent[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [version, setVersion] = useState(0);
  const [limit, setLimit] = useState(5);
  useEffect(() => {
    const changed = () => setVersion((value) => value + 1);
    window.addEventListener(ACTIVITY_CHANGED, changed);
    return () => window.removeEventListener(ACTIVITY_CHANGED, changed);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Drop old token history before reacting to a new token or external activity notification.
    setStatus("loading"); setEvents([]); setLimit(5);
    void getSharedActivity(props.campaignId, props.tokenId, controller.signal).then((rows) => {
      if (!cancelled) { setEvents(rightOwnershipEvents(rows, props.tokenId)); setStatus("ready"); }
    }).catch(() => { if (!cancelled) setStatus("error"); });
    return () => { cancelled = true; controller.abort(); };
  }, [props.tokenId, props.campaignId, version]);

  return <OwnershipHistoryView {...props} events={events} status={status} limit={limit}
    onRefresh={() => setVersion((value) => value + 1)} onMore={() => setLimit((value) => value + 10)} />;
}

export function OwnershipHistoryView({ tokenId, originalOwner, currentOwner, accountId, events, status, limit, onRefresh, onMore }:
  Props & { events: RightOwnershipEvent[]; status: Status; limit: number; onRefresh: () => void; onMore: () => void }) {
  const activityHref = `/transactions?token=${encodeURIComponent(tokenId)}`;
  return <section aria-labelledby="ownership-history-heading" className="rounded-2xl border border-[#293954] bg-[#122344] p-6 md:p-8">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#FF8E9C]">The right in motion</p><h2 id="ownership-history-heading" className="mt-2 text-xl font-semibold text-white">Ownership history</h2></div>
      <button type="button" onClick={onRefresh} disabled={status === "loading"} className="rounded-xl border border-[#293954] px-4 py-2 text-sm text-[#A9B6CF] hover:text-white disabled:opacity-40">Refresh history</button>
    </div>
    <div className="mt-5 grid gap-3 sm:grid-cols-2">
      <Owner label="Original contributor" account={originalOwner} yours={originalOwner === accountId} text="Received this right at campaign creation." />
      <Owner label="Current NFT owner" account={currentOwner} yours={currentOwner === accountId} text="Controls this right's share of future deposits." />
    </div>
    <p className="mt-5 text-sm leading-6 text-[#A9B6CF]">Future revenue follows the current NFT owner. Revenue earned before a transfer remains with the previous owner.</p>
    <p className="mt-2 text-xs leading-5 text-[#71809D]">These events come from finalized Zinc receipts in shared history. Coverage may have gaps and is limited to the latest 200 matching records. The current owner above comes from live contract state; missing events do not mean this right never moved. Times refer to transaction execution blocks, not separate times for each event.</p>
    {status === "loading" && <p role="status" className="mt-5 text-sm text-[#A9B6CF]">Loading verified ownership events...</p>}
    {status === "error" && <p role="alert" className="mt-5 rounded-xl border border-[#FF8E9C]/20 bg-[#FF8E9C]/5 p-4 text-sm leading-6 text-[#FF8E9C]">Ownership history is temporarily unavailable. Current ownership and campaign earnings remain available. Refresh history to retry.</p>}
    {status === "ready" && events.length === 0 && <div className="mt-5 rounded-xl border border-[#293954] bg-[#0B1933] p-5"><h3 className="font-semibold text-white">No verified events recorded yet</h3><p className="mt-2 text-sm leading-6 text-[#A9B6CF]">This NFT exists on-chain. Earlier mint and transfer transactions may not have been imported into shared history. Add a known transaction hash and signer on the activity page to verify it.</p></div>}
    {status === "ready" && events.length > 0 && <>
      <p className="mt-5 text-xs text-[#71809D]">{events.length} verified {events.length === 1 ? "event" : "events"} available · newest blocks first</p>
      <ol className="mt-3 space-y-3">{events.slice(0, limit).map((event) => <li key={event.id} className="rounded-xl border border-[#293954] bg-[#0B1933] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-sm font-semibold text-white">{event.kind === "NFT Mints" ? "Revenue right minted" : "Revenue right transferred"}</h3><span className="rounded-full border border-[#69dab8]/20 bg-[#69dab8]/10 px-2 py-1 text-xs text-[#69dab8]">Verified receipt</span></div>
        <time dateTime={new Date(event.timestampMs).toISOString()} className="mt-2 block text-xs text-[#71809D]">{new Date(event.timestampMs).toISOString().replace("T", " ").slice(0, 19)} UTC</time>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          {event.from && <EventAccount label="From owner" account={event.from} accountId={accountId} />}
          <EventAccount label={event.kind === "NFT Mints" ? "Minted to" : "To owner"} account={event.to} accountId={accountId} />
        </dl>
        <a href={`https://testnet.nearblocks.io/txns/${encodeURIComponent(event.hash)}`} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex text-sm text-[#FF8E9C]">View transaction on NEAR Blocks ↗</a>
      </li>)}</ol>
      {limit < events.length && <button type="button" onClick={onMore} className="mt-4 rounded-xl border border-[#293954] px-4 py-2 text-sm text-[#A9B6CF] hover:text-white">Show more events ({events.length - limit} remaining)</button>}
    </>}
    <div className="mt-5 flex flex-wrap gap-4 border-t border-[#293954] pt-4 text-sm text-[#FF8E9C]">
      <Link href={activityHref}>View activity / verify an earlier transaction ↗</Link>
      {accountId && <a href="#campaign-account-earnings">View your campaign earnings ↓</a>}
    </div>
    <p className="mt-3 text-xs leading-5 text-[#71809D]">Claims are recorded per campaign and account. They are not shown here as individual NFT payouts. You can claim retained historical earnings through your campaign balance even after transferring this right.</p>
  </section>;
}

function Owner({ label, account, yours, text }: { label: string; account: string; yours: boolean; text: string }) {
  return <div className="min-w-0 rounded-xl border border-[#293954] bg-[#0B1933] p-4"><h3 className="text-xs text-[#A9B6CF]">{label}{yours && <span className="ml-2 rounded-full bg-[#69dab8]/10 px-2 py-1 text-[#69dab8]">You</span>}</h3><p className="mt-3 break-all text-sm text-white">{account}</p><p className="mt-2 text-xs leading-5 text-[#71809D]">{text}</p></div>;
}
function EventAccount({ label, account, accountId }: { label: string; account: string; accountId: string | null }) {
  return <div className="min-w-0"><dt className="text-xs text-[#71809D]">{label}{accountId === account && <span className="ml-2 text-[#69dab8]">You</span>}</dt><dd className="mt-1 break-all text-sm text-[#A9B6CF]">{account}</dd></div>;
}
