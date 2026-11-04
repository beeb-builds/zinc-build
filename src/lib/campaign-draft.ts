import type { CreateCampaignInput } from "./zinc-write";

export type CampaignDraftInput = {
  campaignName: string;
  description: string;
  startDate: string;
  endDate: string;
  contributors: { role: string; wallet: string; share: number }[];
  treasuryWallet: string;
  treasuryShare: number;
};

/** Parse the entered decimal representation without rounding a revenue agreement. */
export function percentageToBps(percentage: number): number | null {
  if (!Number.isFinite(percentage)) return null;
  const match = /^(\d{1,3})(?:\.(\d{1,2}))?$/.exec(String(percentage));
  if (!match) return null;
  const bps = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  return bps > 0 && bps <= 10_000 ? bps : null;
}

function validAccount(value: string) {
  const account = value.trim();
  return account.length >= 2 && account.length <= 64 && /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/.test(account);
}

function dateTimestamp(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isSafeInteger(timestamp) && timestamp >= 0 && new Date(timestamp).toISOString().slice(0, 10) === value ? timestamp : null;
}

export function validateCampaignDraft(draft: CampaignDraftInput) {
  const shares = draft.contributors.map((contributor) => percentageToBps(contributor.share));
  const treasuryBps = percentageToBps(draft.treasuryShare);
  const sharesValid = shares.every((share) => share !== null) && treasuryBps !== null;
  const totalBps = sharesValid ? shares.reduce<number>((sum, share) => sum + share!, 0) + treasuryBps! : null;
  const allocationsValid = totalBps === 10_000;
  const contributorsValid = draft.contributors.length > 0 && draft.contributors.every((contributor, index) =>
    contributor.role.trim() !== "" && validAccount(contributor.wallet) && shares[index] !== null);
  const treasuryValid = validAccount(draft.treasuryWallet) && treasuryBps !== null;
  const start = dateTimestamp(draft.startDate), end = dateTimestamp(draft.endDate);
  const datesValid = start !== null && end !== null && end > start;
  const campaignDetailsValid = draft.campaignName.trim() !== "" && draft.description.trim() !== "";
  const errors: string[] = [];
  if (!campaignDetailsValid) errors.push("Enter a campaign name and description.");
  if (!datesValid) errors.push("Choose valid dates with the end later than the start. Dates begin at 00:00 UTC.");
  if (!contributorsValid) errors.push("Each contributor needs a role, a valid NEAR account ID and a positive share with at most two decimal places.");
  if (!treasuryValid) errors.push("Enter a valid treasury account ID and a positive share with at most two decimal places.");
  if (!allocationsValid) errors.push("Contributor and treasury shares must total exactly 100%, with at most two decimal places per share.");
  const input: CreateCampaignInput | null = errors.length ? null : {
    name: draft.campaignName.trim(), description: draft.description.trim(),
    startTimestampMs: start!, endTimestampMs: end!,
    contributors: draft.contributors.map((contributor, index) => ({
      role: contributor.role.trim(), accountId: contributor.wallet.trim(), shareBps: shares[index]!,
    })),
    treasuryAccount: draft.treasuryWallet.trim(), treasuryShareBps: treasuryBps!,
  };
  return { input, errors, allocationsValid, contributorsValid, treasuryValid, datesValid, campaignDetailsValid, totalBps };
}
