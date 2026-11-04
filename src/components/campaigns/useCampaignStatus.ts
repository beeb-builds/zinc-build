"use client";

import { useEffect, useRef, useState } from "react";
import { campaignStatus, type CampaignStatus } from "../../lib/campaign-discovery";

/** Update at the next boundary rather than polling every second. Chain time remains authoritative. */
export function useCampaignStatus(startTimestampMs: number, endTimestampMs: number, initialStatus: CampaignStatus) {
  const [status, setStatus] = useState(initialStatus);
  const recheck = useRef<() => void>(() => {});
  useEffect(() => {
    let timer: number | undefined;
    function update() {
      if (timer !== undefined) window.clearTimeout(timer);
      timer = undefined;
      const now = Date.now();
      const current = campaignStatus({ start_timestamp_ms: startTimestampMs, end_timestamp_ms: endTimestampMs }, now);
      setStatus(current);
      // The contract accepts the end timestamp itself; close at the following millisecond.
      const next = current === "Scheduled" ? startTimestampMs : current === "Active" ? endTimestampMs + 1 : null;
      if (next !== null && Number.isFinite(next) && next > now) {
        timer = window.setTimeout(update, Math.min(next - now, 2147483647));
      }
    }
    recheck.current = update;
    update();
    window.addEventListener("focus", update);
    window.addEventListener("pageshow", update);
    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
      window.removeEventListener("focus", update);
      window.removeEventListener("pageshow", update);
      recheck.current = () => {};
    };
  }, [startTimestampMs, endTimestampMs]);
  return { status, recheck: () => recheck.current() };
}
