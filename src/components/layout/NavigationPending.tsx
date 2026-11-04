"use client";

import { useLinkStatus } from "next/link";

/** Next owns the pending lifecycle, including canceled and superseded navigation. */
export default function NavigationPending({ label }: { label: string }) {
  const { pending } = useLinkStatus();
  return <>
    <span aria-hidden="true" className="pointer-events-none absolute bottom-1 right-1 h-2 w-2">
      {pending && <span className="zinc-nav-pending block h-full w-full rounded-full bg-[#ffb1a8] ring-2 ring-[#08172f]" />}
    </span>
    {pending && <span role="status" className="sr-only">Opening {label}...</span>}
  </>;
}
