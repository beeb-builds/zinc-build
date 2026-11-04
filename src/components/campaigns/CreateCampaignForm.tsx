"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useWallet } from "../wallet/WalletProvider";
import { createCampaignOnNear } from "../../lib/zinc-write";
import { percentageToBps, validateCampaignDraft } from "../../lib/campaign-draft";
import CampaignRightsPreview from "./CampaignRightsPreview";
import CampaignCreated from "./CampaignCreated";
import { campaignConfirmation, type CampaignConfirmation } from "../../lib/campaign-confirmation";
import TransactionProgress, { useTransactionProgress, type TransactionProgressState } from "../transactions/TransactionProgress";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Plus,
  ShieldCheck,
  Trash2,
  UserRound,
  Wallet,
} from "lucide-react";

type Contributor = {
  id: number;
  role: string;
  wallet: string;
  share: number;
};

type CampaignDraft = {
  campaignName: string;
  description: string;
  startDate: string;
  endDate: string;
  treasuryWallet: string;
  treasuryShare: number;
  contributors: Contributor[];
};

const DRAFT_KEY = "zinc-campaign-draft";

const defaultContributors: Contributor[] = [
  {
    id: 1,
    role: "Artist",
    wallet: "",
    share: 25,
  },
  {
    id: 2,
    role: "Developer",
    wallet: "",
    share: 20,
  },
  {
    id: 3,
    role: "Promoter",
    wallet: "",
    share: 15,
  },
];

export default function CreateCampaignForm() {
  const transaction = useTransactionProgress();
  const { selector, accountId, connect } = useWallet();
  const submissionLocked = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [created, setCreated] = useState<CampaignConfirmation | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [campaignName, setCampaignName] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [treasuryWallet, setTreasuryWallet] = useState("");
  const [treasuryShare, setTreasuryShare] = useState(40);

  const [contributors, setContributors] =
    useState<Contributor[]>(defaultContributors);

  const [isReviewing, setIsReviewing] = useState(false);

  // Prevents the empty initial state from overwriting
  // a previously saved draft before restoration finishes.
  const [draftLoaded, setDraftLoaded] = useState(false);

  // --------------------------------------------------
  // RESTORE SAVED DRAFT
  // --------------------------------------------------

  useEffect(() => {
    try {
      const savedDraft = window.localStorage.getItem(DRAFT_KEY);

      if (savedDraft) {
        const draft: CampaignDraft = JSON.parse(savedDraft);

        // eslint-disable-next-line react-hooks/set-state-in-effect -- Restore browser-only persisted draft after hydration; draftLoaded prevents an empty autosave overwriting it.
        setCampaignName(draft.campaignName ?? "");
        setDescription(draft.description ?? "");
        setStartDate(draft.startDate ?? "");
        setEndDate(draft.endDate ?? "");
        setTreasuryWallet(draft.treasuryWallet ?? "");
        setTreasuryShare(
          typeof draft.treasuryShare === "number"
            ? draft.treasuryShare
            : 40,
        );

        if (
          Array.isArray(draft.contributors) &&
          draft.contributors.length > 0
        ) {
          setContributors(draft.contributors);
        }
      }
    } catch (error) {
      console.error("Could not restore Zinc campaign draft:", error);
    } finally {
      setDraftLoaded(true);
    }
  }, []);

  // --------------------------------------------------
  // AUTO-SAVE DRAFT
  // --------------------------------------------------

  useEffect(() => {
    if (!draftLoaded || created) {
      return;
    }

    const draft: CampaignDraft = {
      campaignName,
      description,
      startDate,
      endDate,
      treasuryWallet,
      treasuryShare,
      contributors,
    };

    try {
      window.localStorage.setItem(
        DRAFT_KEY,
        JSON.stringify(draft),
      );
    } catch (error) {
      console.error("Could not save Zinc campaign draft:", error);
    }
  }, [
    campaignName,
    description,
    startDate,
    endDate,
    treasuryWallet,
    treasuryShare,
    contributors,
    draftLoaded,
    created,
  ]);

  // --------------------------------------------------
  // ALLOCATION CALCULATIONS
  // --------------------------------------------------

  const contributorTotal = useMemo(
    () => {
      const bps = contributors.map((contributor) => percentageToBps(contributor.share));
      return bps.every((share) => share !== null)
        ? bps.reduce<number>((sum, share) => sum + share!, 0) / 100
        : contributors.reduce((total, contributor) => total + Number(contributor.share || 0), 0);
    },
    [contributors],
  );

  // --------------------------------------------------
  // VALIDATION
  // --------------------------------------------------

  const validation = validateCampaignDraft({ campaignName, description, startDate, endDate, contributors, treasuryWallet, treasuryShare });
  const { allocationsValid, contributorsValid, datesValid, campaignDetailsValid, treasuryValid } = validation;
  const formValid = validation.input !== null;
  const totalAllocation = validation.totalBps !== null ? validation.totalBps / 100 : contributorTotal + Number(treasuryShare || 0);

  // --------------------------------------------------
  // CONTRIBUTORS
  // --------------------------------------------------

  function updateContributor(
    id: number,
    field: keyof Contributor,
    value: string | number,
  ) {
    setContributors((current) =>
      current.map((contributor) =>
        contributor.id === id
          ? {
              ...contributor,
              [field]: value,
            }
          : contributor,
      ),
    );
  }

  function addContributor() {
    setContributors((current) => [
      ...current,
      {
        id: Date.now(),
        role: "",
        wallet: "",
        share: 0,
      },
    ]);
  }

  function removeContributor(id: number) {
    setContributors((current) =>
      current.filter(
        (contributor) => contributor.id !== id,
      ),
    );
  }

  // --------------------------------------------------
  // CLEAR DRAFT
  // --------------------------------------------------

  function clearDraft() {
    const confirmed = window.confirm(
      "Clear this campaign draft and start again?",
    );

    if (!confirmed) {
      return;
    }

    window.localStorage.removeItem(DRAFT_KEY);

    setCampaignName("");
    setDescription("");
    setStartDate("");
    setEndDate("");
    setTreasuryWallet("");
    setTreasuryShare(40);
    setContributors(defaultContributors);
    setIsReviewing(false);
  }

  // --------------------------------------------------
  // REVIEW
  // --------------------------------------------------

  function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!formValid) {
      return;
    }

    setIsReviewing(true);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  async function createCampaign() {
    if (submissionLocked.current) return;
    // Revalidate the exact reviewed values before opening the wallet.
    if (!validation.input) { setSubmitError(validation.errors.join(" ")); return; }
    if (!selector || !accountId) {
      setSubmitError("Connect a NEAR Testnet wallet before creating your campaign.");
      return;
    }

    submissionLocked.current = true;
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const input = validation.input;
      const outcome = await transaction.run((report) => createCampaignOnNear(selector, input, report));

      // Redirect-based wallets may return without a confirmed outcome.
      if (!outcome) {
        throw new Error("No transaction confirmation was returned by your wallet. Check your wallet activity before trying again.");
      }
      const statuses = [
        outcome.status,
        outcome.transaction_outcome.outcome.status,
        ...outcome.receipts_outcome.map((receipt) => receipt.outcome.status),
      ];
      if (statuses.some((status) => typeof status === "object" && "Failure" in status)) {
        throw new Error("The transaction failed on NEAR. Check your wallet activity for details, then try again.");
      }

      const confirmation = campaignConfirmation(outcome);
      setCreated(confirmation);
      try {
        window.localStorage.removeItem(DRAFT_KEY);
      } catch (error) {
        console.error("Campaign created, but could not clear the saved draft:", error);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message :
        typeof error === "string" ? error : "Your wallet could not complete the transaction.";
      setSubmitError(
        /reject|cancel|denied|declin/i.test(message)
          ? "Transaction cancelled or rejected in your wallet. Your draft is saved; you can try again."
          : `Could not create campaign: ${message}`,
      );
      submissionLocked.current = false;
      setIsSubmitting(false);
    }
  }

  if (created) return <CampaignCreated confirmation={created} />;

  if (isReviewing) {
    return (
      <CampaignReview
        campaignName={campaignName}
        description={description}
        startDate={startDate}
        endDate={endDate}
        contributors={contributors}
        treasuryWallet={treasuryWallet}
        treasuryShare={treasuryShare}
        totalAllocation={totalAllocation}
        isSubmitting={isSubmitting}
        submitError={submitError}
        progress={transaction.progress}
        walletConnected={Boolean(accountId && selector)}
        creatorAccount={accountId}
        onConnect={connect}
        onCreate={createCampaign}
        onBack={() => {
          setIsReviewing(false);

          window.scrollTo({
            top: 0,
            behavior: "smooth",
          });
        }}
      />
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,0.7fr)]">
        {/* LEFT */}

        <div className="min-w-0 space-y-6">
          {/* STEP 01 */}

          <section className="rounded-[28px] border border-white/[0.06] bg-[#10213d] p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#ff7568]">
                  Step 01
                </p>

                <h2 className="mt-2 text-xl font-semibold">
                  Campaign details
                </h2>

                <p className="mt-2 text-sm text-[#7185a1]">
                  Record your project&apos;s revenue agreement. Contributor shares become transferable revenue-right NFTs.
                </p>
              </div>

              <button
                type="button"
                onClick={clearDraft}
                className="rounded-xl border border-white/[0.07] px-3 py-2 text-xs font-medium text-[#7185a1] transition hover:border-[#ff7568]/30 hover:text-[#ff8b80]"
              >
                Clear draft
              </button>
            </div>

            <div className="mt-6 space-y-5">
              <label className="block">
                <span className="mb-2 block text-sm text-[#9aacbf]">
                  Campaign name
                </span>

                <input
                  value={campaignName}
                  onChange={(event) =>
                    setCampaignName(event.target.value)
                  }
                  placeholder="AlphaCats Launch"
                  className="w-full rounded-xl border border-white/[0.07] bg-[#0b1b34] px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-[#465d7b] focus:border-[#ff7568]/40"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm text-[#9aacbf]">
                  Description
                </span>

                <textarea
                  value={description}
                  onChange={(event) =>
                    setDescription(event.target.value)
                  }
                  placeholder="Describe what this revenue campaign is for..."
                  rows={4}
                  className="w-full resize-none rounded-xl border border-white/[0.07] bg-[#0b1b34] px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-[#465d7b] focus:border-[#ff7568]/40"
                />
              </label>

              <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="min-w-0">
                  <span className="mb-2 flex items-center gap-2 text-sm text-[#9aacbf]">
                    <CalendarDays size={15} />
                    Start date
                  </span>

                  <input
                    type="date"
                    value={startDate}
                    onChange={(event) =>
                      setStartDate(event.target.value)
                    }
                    className="block w-full min-w-0 max-w-full rounded-xl border border-white/[0.07] bg-[#0b1b34] px-4 py-3.5 text-sm text-white outline-none focus:border-[#ff7568]/40"
                  />
                </label>

                <label className="min-w-0">
                  <span className="mb-2 flex items-center gap-2 text-sm text-[#9aacbf]">
                    <CalendarDays size={15} />
                    End date
                  </span>

                  <input
                    type="date"
                    value={endDate}
                    min={startDate || undefined}
                    onChange={(event) =>
                      setEndDate(event.target.value)
                    }
                    className="block w-full min-w-0 max-w-full rounded-xl border border-white/[0.07] bg-[#0b1b34] px-4 py-3.5 text-sm text-white outline-none focus:border-[#ff7568]/40"
                  />
                </label>
              </div>

              <p className="text-xs leading-5 text-[#7185a1]">Start and end dates mean 00:00 UTC on the selected day. Deposits close at the start of the end date.</p>

              {startDate &&
                endDate &&
                !datesValid && (
                  <p className="text-sm text-[#ff8b80]">
                    End date must be later than the start date.
                  </p>
                )}
            </div>
          </section>

          {/* STEP 02 */}

          <section className="rounded-[28px] border border-white/[0.06] bg-[#10213d] p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#ff7568]">
                  Step 02
                </p>

                <h2 className="mt-2 text-xl font-semibold">
                  Contributor rights
                </h2>

                <p className="mt-2 text-sm text-[#7185a1]">
                  Each contributor row creates one Revenue Right NFT for the wallet you enter. Set its share of future campaign deposits.
                </p>
              </div>

              <button
                type="button"
                onClick={addContributor}
                className="flex w-fit items-center gap-2 rounded-xl border border-[#ff7568]/20 bg-[#ff7568]/10 px-3 py-2 text-sm font-semibold text-[#ff8b80]"
              >
                <Plus size={15} />
                Add contributor
              </button>
            </div>

            <div className="mt-6 space-y-4">
              {contributors.map(
                (contributor, index) => (
                  <div
                    key={contributor.id}
                    className="rounded-2xl border border-white/[0.05] bg-[#0b1b34] p-4"
                  >
                    <div className="mb-4 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#172d4d] text-[#ff7c70]">
                          <UserRound size={15} />
                        </div>

                        <span className="text-sm font-medium">
                          Contributor {index + 1}
                        </span>
                      </div>

                      {contributors.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            removeContributor(
                              contributor.id,
                            )
                          }
                          title="Remove contributor"
                          className="text-[#607694] transition hover:text-[#ff7568]"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>

                    <div className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-[minmax(0,0.7fr)_minmax(0,1.5fr)_minmax(0,0.5fr)]">
                      <input
                        value={contributor.role}
                        onChange={(event) =>
                          updateContributor(
                            contributor.id,
                            "role",
                            event.target.value,
                          )
                        }
                        placeholder="Role"
                        className="min-w-0 rounded-xl border border-white/[0.07] bg-[#10213d] px-3 py-3 text-sm text-white outline-none placeholder:text-[#465d7b]"
                      />

                      <input
                        value={contributor.wallet}
                        onChange={(event) =>
                          updateContributor(
                            contributor.id,
                            "wallet",
                            event.target.value,
                          )
                        }
                        placeholder="contributor.testnet"
                        className="min-w-0 rounded-xl border border-white/[0.07] bg-[#10213d] px-3 py-3 text-sm text-white outline-none placeholder:text-[#465d7b]"
                      />

                      <div className="relative">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={contributor.share}
                          onChange={(event) =>
                            updateContributor(
                              contributor.id,
                              "share",
                              Number(
                                event.target.value,
                              ),
                            )
                          }
                          className="w-full rounded-xl border border-white/[0.07] bg-[#10213d] px-3 py-3 pr-8 text-sm text-white outline-none"
                        />

                        <span className="pointer-events-none absolute right-3 top-3 text-sm text-[#667b98]">
                          %
                        </span>
                      </div>
                    </div>
                  </div>
                ),
              )}
            </div>
          </section>

          {/* STEP 03 */}

          <section className="rounded-[28px] border border-white/[0.06] bg-[#10213d] p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#ff7568]">
              Step 03
            </p>

            <h2 className="mt-2 text-xl font-semibold">
              Project treasury
            </h2>

            <p className="mt-2 text-sm text-[#7185a1]">
              Set the account-based treasury share. Treasury receives no NFT unless it is also listed separately as a contributor.
            </p>

            <div className="mt-6 grid min-w-0 grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_180px]">
              <label className="min-w-0">
                <span className="mb-2 flex items-center gap-2 text-sm text-[#9aacbf]">
                  <Wallet size={15} />
                  Treasury wallet
                </span>

                <input
                  value={treasuryWallet}
                  onChange={(event) =>
                    setTreasuryWallet(
                      event.target.value,
                    )
                  }
                  placeholder="project.testnet"
                  className="w-full rounded-xl border border-white/[0.07] bg-[#0b1b34] px-4 py-3.5 text-sm text-white outline-none placeholder:text-[#465d7b]"
                />
              </label>

              <label>
                <span className="mb-2 block text-sm text-[#9aacbf]">
                  Treasury share
                </span>

                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={treasuryShare}
                    onChange={(event) =>
                      setTreasuryShare(
                        Number(event.target.value),
                      )
                    }
                    className="w-full rounded-xl border border-white/[0.07] bg-[#0b1b34] px-4 py-3.5 pr-9 text-sm text-white outline-none"
                  />

                  <span className="pointer-events-none absolute right-4 top-3.5 text-[#667b98]">
                    %
                  </span>
                </div>
              </label>
            </div>
          </section>
        </div>

        {/* SUMMARY */}

        <aside className="h-fit rounded-[28px] border border-white/[0.06] bg-[#10213d] p-6 xl:sticky xl:top-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#ff7568]">
            Campaign Summary
          </p>

          <h3 className="mt-3 text-xl font-semibold">
            {campaignName.trim() ||
              "Untitled Campaign"}
          </h3>

          <p className="mt-2 text-xs text-[#617692]">
            Draft automatically saved on this device
          </p>

          <div className="mt-7 space-y-4">
            <SummaryLine
              label="Revenue-right NFTs to mint"
              value={String(contributors.length)}
            />

            <SummaryLine
              label="Contributor rights"
              value={`${contributorTotal}%`}
            />

            <SummaryLine
              label="Treasury"
              value={`${treasuryShare}%`}
            />
          </div>

          <div
            className={`mt-6 rounded-2xl border p-5 ${
              allocationsValid
                ? "border-[#4dd4ad]/20 bg-[#153c39]"
                : "border-[#ff7568]/20 bg-[#ff7568]/10"
            }`}
          >
            <p className="text-sm text-[#8fa0bc]">
              Total allocation
            </p>

            <div className="mt-2 flex items-end justify-between gap-4">
              <strong className="text-3xl">
                {totalAllocation}%
              </strong>

              <span
                className={`text-xs font-semibold ${
                  formValid
                    ? "text-[#69dab8]"
                    : "text-[#ff8b80]"
                }`}
              >
                {!allocationsValid
                  ? "Must equal 100%"
                  : formValid
                    ? "Ready"
                    : "Complete campaign"}
              </span>
            </div>
          </div>

          <div className="mt-5 space-y-3 rounded-2xl bg-[#0b1b34] p-4">
            <ValidationItem
              label="Campaign details"
              valid={campaignDetailsValid}
            />

            <ValidationItem
              label="Campaign dates"
              valid={datesValid}
            />

            <ValidationItem
              label="Contributor information"
              valid={contributorsValid}
            />

            <ValidationItem
              label="Treasury wallet"
              valid={treasuryValid}
            />

            <ValidationItem
              label="100% allocation"
              valid={allocationsValid}
            />
          </div>

          {!formValid && <ul aria-label="Campaign requirements" className="mt-4 space-y-2 text-xs leading-5 text-[#9aacbf]">{validation.errors.map((message) => <li key={message}>{message}</li>)}</ul>}
          <p className="mt-4 text-xs leading-5 text-[#617692]">Account ID checks verify syntax only. Confirm each recipient wallet carefully before signing.</p>

          <button
            type="submit"
            disabled={!formValid}
            className="mt-6 w-full rounded-xl bg-gradient-to-r from-[#ff685b] to-[#ff8a9c] px-4 py-3.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Review Campaign &amp; NFTs
          </button>
          {!accountId && (
            <p className="mt-3 text-sm text-[#ff8b80]">
              Connect a NEAR Testnet wallet to create your campaign.
            </p>
          )}
        </aside>
      </div>
    </form>
  );
}

// --------------------------------------------------
// REVIEW SCREEN
// --------------------------------------------------

type CampaignReviewProps = {
  campaignName: string;
  description: string;
  startDate: string;
  endDate: string;
  contributors: Contributor[];
  treasuryWallet: string;
  treasuryShare: number;
  totalAllocation: number;
  onBack: () => void;
  isSubmitting: boolean;
  submitError: string | null;
  progress: TransactionProgressState | null;
  walletConnected: boolean;
  creatorAccount: string | null;
  onConnect: () => void;
  onCreate: () => Promise<void>;
};

function CampaignReview({
  campaignName,
  description,
  startDate,
  endDate,
  contributors,
  treasuryWallet,
  treasuryShare,
  totalAllocation,
  onBack,
  isSubmitting,
  submitError,
  progress,
  walletConnected,
  creatorAccount,
  onConnect,
  onCreate,
}: CampaignReviewProps) {
  return (
    <div className="mx-auto max-w-5xl">
      <button
        type="button"
        onClick={onBack}
        disabled={isSubmitting}
        className="mb-6 flex items-center gap-2 text-sm text-[#7185a1] transition hover:text-white"
      >
        <ArrowLeft size={16} />
        Back & Edit
      </button>

      <div className="rounded-[30px] border border-white/[0.06] bg-[#10213d] p-6 md:p-8">
        <div className="flex flex-col gap-5 border-b border-white/[0.06] pb-7 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#ff7568]">
              Final Review
            </p>

            <h2 className="mt-3 text-3xl font-semibold">
              {campaignName}
            </h2>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#7f91aa]">
              {description}
            </p>
          </div>

          <div className="flex w-fit items-center gap-2 rounded-full border border-[#69dab8]/20 bg-[#153c39] px-4 py-2 text-sm font-semibold text-[#69dab8]">
            <CheckCircle2 size={16} />
            Ready
          </div>
        </div>

        <div className="mt-7 grid gap-4 sm:grid-cols-2">
          <ReviewInfo
            label="Start date"
            value={formatDate(startDate)}
          />

          <ReviewInfo
            label="End date"
            value={formatDate(endDate)}
          />
        </div>

        <p className="mt-3 text-xs leading-5 text-[#7185a1]">Dates begin at 00:00 UTC. The end date closes deposits at the start of that day. Shares support up to two decimal places and are sent exactly as reviewed, without rounding.</p>

        <CampaignRightsPreview campaignName={campaignName} contributors={contributors}
          treasuryWallet={treasuryWallet} treasuryShare={treasuryShare} creatorAccount={creatorAccount} />

        <div className="mt-7 flex flex-col gap-5 rounded-2xl border border-[#69dab8]/15 bg-[#153c39]/70 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-[#91b9ae]">
              Total campaign allocation
            </p>

            <p className="mt-1 text-3xl font-semibold">
              {totalAllocation}%
            </p>
          </div>

          <div className="flex items-center gap-2 text-sm font-semibold text-[#69dab8]">
            <ShieldCheck size={18} />
            Allocation totals 100%
          </div>
        </div>

        <div className="mt-8 rounded-2xl border border-white/[0.06] bg-[#0b1b34] p-5">
          <div className="flex gap-3">
            <ShieldCheck
              size={20}
              className="mt-0.5 shrink-0 text-[#ff8175]"
            />

            <div>
              <p className="font-semibold">
                Next: NEAR transaction
              </p>

              <p className="mt-2 text-sm leading-6 text-[#7185a1]">
                {walletConnected
                  ? "Confirm one transaction in your wallet to create the campaign and mint the contributor revenue-right NFTs on NEAR Testnet."
                  : "Connect a NEAR Testnet wallet before creating your campaign."}
              </p>
            </div>
          </div>
        </div>

        {submitError && (
          <p role="alert" className="mt-5 text-sm text-[#ff8b80]">
            {submitError}
          </p>
        )}
        <div className="mt-5"><TransactionProgress progress={progress} /></div>

        <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onBack}
            disabled={isSubmitting}
            className="rounded-xl border border-white/[0.08] bg-[#0b1b34] px-5 py-3.5 text-sm font-semibold text-[#aebbd0]"
          >
            Back & Edit
          </button>

          <button
            type="button"
            onClick={walletConnected ? onCreate : onConnect}
            disabled={isSubmitting}
            className="rounded-xl bg-gradient-to-r from-[#ff685b] to-[#ff8a9c] px-6 py-3.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? "Creating Campaign…" : walletConnected ? "Create Campaign on NEAR" : "Connect Wallet"}
          </button>
        </div>
      </div>
    </div>
  );
}

// --------------------------------------------------
// SMALL UI COMPONENTS
// --------------------------------------------------

function SummaryLine({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <span className="text-[#7185a1]">
        {label}
      </span>

      <strong>{value}</strong>
    </div>
  );
}

function ValidationItem({
  label,
  valid,
}: {
  label: string;
  valid: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-[#7185a1]">
        {label}
      </span>

      <span
        className={
          valid
            ? "font-medium text-[#69dab8]"
            : "font-medium text-[#ff8b80]"
        }
      >
        {valid ? "Complete" : "Required"}
      </span>
    </div>
  );
}

function ReviewInfo({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl bg-[#0b1b34] p-5">
      <p className="text-xs text-[#617692]">
        {label}
      </p>

      <p className="mt-2 font-semibold">
        {value}
      </p>
    </div>
  );
}

function formatDate(value: string) {
  const [year, month, day] =
    value.split("-").map(Number);

  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(
    new Date(year, month - 1, day),
  );
}
