"use client";

import { useEffect } from "react";
import { browserReads, invalidateReadCache, isBrowserWriteActive } from "../../lib/read-scheduler";
import { ZINC_CONTRACT_ID } from "../../lib/near";

export default function ReadCacheSync() {
  useEffect(() => {
    let lastRefresh = 0;
    const invalidate = () => {
      // A wallet popup returning focus must not unmount an active signing form.
      if (isBrowserWriteActive()) browserReads.invalidate();
      else invalidateReadCache();
    };
    const onReturn = () => {
      if (document.visibilityState !== "visible" || Date.now() - lastRefresh < 1000) return;
      lastRefresh = Date.now();
      invalidate();
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key?.startsWith("zinc:confirmed-activity:") && event.key.includes(ZINC_CONTRACT_ID)) invalidate();
    };
    window.addEventListener("focus", onReturn);
    document.addEventListener("visibilitychange", onReturn);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("focus", onReturn);
      document.removeEventListener("visibilitychange", onReturn);
      window.removeEventListener("storage", onStorage);
    };
  }, []);
  return null;
}
