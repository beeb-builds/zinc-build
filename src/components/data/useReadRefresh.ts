"use client";

import { useEffect, useState } from "react";
import { invalidateReadCache, READS_INVALIDATED } from "../../lib/read-scheduler";

export function useReadRefresh() {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const update = () => setVersion((value) => value + 1);
    window.addEventListener(READS_INVALIDATED, update);
    return () => window.removeEventListener(READS_INVALIDATED, update);
  }, []);
  return { version, refresh: invalidateReadCache };
}
