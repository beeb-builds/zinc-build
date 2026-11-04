"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getCampaign, getCampaignRights } from "../../lib/zinc-contract";
import { workspaceEligibility, type WorkspaceEligibility as Preview } from "../../lib/workspace-eligibility";
import { useReadRefresh } from "../data/useReadRefresh";

export default function WorkspaceEligibility({ campaignId, accountId, busy, onEligibility }: { campaignId: number; accountId: string; busy: boolean; onEligibility: (eligible: boolean) => void }) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error" | "missing">("loading");
  const { version, refresh } = useReadRefresh();
  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Revoke stale public eligibility immediately before the new identity's external ownership read.
    setPreview(null); setState("loading"); onEligibility(false);
    void Promise.all([getCampaign(campaignId), getCampaignRights(campaignId).catch(() => null)]).then(([campaign, rights]) => {
      if (cancelled) return;
      if (!campaign || campaign.id !== campaignId) { setState("missing"); return; }
      const value = workspaceEligibility(campaign, rights, accountId);
      setPreview(value); setState("ready"); onEligibility(value.role === "creator" || value.role === "holder");
    }).catch(() => { if (!cancelled) setState("error"); });
    return () => { cancelled = true; };
  }, [campaignId, accountId, version, onEligibility]);
  return <WorkspaceEligibilityView campaignId={campaignId} preview={preview} state={state} busy={busy} onRefresh={refresh} />;
}

export function WorkspaceEligibilityView({ campaignId, preview, state, busy, onRefresh }: { campaignId: number; preview: Preview | null; state: "loading" | "ready" | "error" | "missing"; busy: boolean; onRefresh: () => void }) {
  return <section aria-label="Workspace eligibility preview" className="rounded-xl border border-[#293954] bg-[#0B1933] p-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold text-white">Your workspace eligibility</h3><button type="button" onClick={onRefresh} disabled={busy || state === "loading"} className="rounded-lg border border-[#293954] px-3 py-2 text-xs text-[#A9B6CF] disabled:opacity-40">Refresh eligibility</button></div>
    {state === "loading" ? <p role="status" className="mt-3 text-sm text-[#A9B6CF]">Reading public campaign roles and NFT ownership...</p>
      : state === "missing" ? <p role="status" className="mt-3 text-sm text-[#FF8E9C]">This campaign could not be found. No workspace signature is needed for this result.</p>
      : state === "error" || !preview ? <p role="status" className="mt-3 text-sm text-[#FF8E9C]">Eligibility could not be loaded. Refresh to retry; unavailable ownership is not treated as zero holdings.</p>
      : <><p className="mt-3 break-words text-sm font-semibold text-white">{preview.campaignName}</p>
        <p className="mt-3 text-sm leading-6 text-[#A9B6CF]">{preview.role === "creator" ? "You are the campaign creator. You can request read and publish access, including after transferring your own NFTs. This is a separate editorial role."
          : preview.role === "holder" ? "Your wallet currently appears to own a campaign revenue-right NFT. You can request read-only access to the creator's brief."
          : preview.role === "unknown" ? "Current ownership could not be verified in this preview. Refresh eligibility before requesting access."
          : "This wallet has no current campaign NFT in the available ownership snapshot. Former ownership and treasury status alone do not unlock the brief."}</p>
        {preview.ownedRights !== null && <p className="mt-3 text-xs text-[#71809D]">Current campaign NFT rights in this snapshot: {preview.ownedRights}</p>}
        {preview.originalContributor && <p className="mt-2 text-xs text-[#71809D]">You are an original contributor. Original allocation alone does not prove current ownership.</p>}
        {preview.treasury && <p className="mt-2 text-xs text-[#71809D]">You are the treasury account. Treasury is account-based and does not itself grant holder access.</p>}
        {preview.role === "ineligible" && <Link href={`/campaigns/${campaignId}#claim-revenue`} className="mt-4 inline-flex text-sm text-[#FF8E9C]">View any retained historical or treasury earnings ↗</Link>}
      </>}
    <p className="mt-4 text-xs leading-5 text-[#71809D]">This is a public, read-only preview, not an access grant. Opening the private brief still requires a signed wallet message and fresh finalized ownership checks on the server. A recent transfer may not be finalized yet.</p>
  </section>;
}
