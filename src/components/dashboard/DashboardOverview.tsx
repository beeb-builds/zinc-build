"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { yoctoToNear } from "near-api-js";
import {
  RefreshCw,
  CircleDollarSign,
  Plus,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";

import type { LucideIcon } from "lucide-react";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import DashboardShell from "../layout/DashboardShell";
import { useReadRefresh } from "../data/useReadRefresh";
import { getCampaigns, getNftTotalSupply, type OnChainCampaign } from "../../lib/zinc-contract";
import { campaignStatus, validateDiscoveryCampaigns } from "../../lib/campaign-discovery";

const allocationColors = ["#ff6d5f", "#ff8da1", "#e7bf72", "#69dab8", "#8fa0bc"];

function statusStyle(status: string) {
  return status === "Active" ? "bg-[#153c39] text-[#69dab8]" : status === "Scheduled" ? "bg-[#352d24] text-[#e7bf72]" : "bg-[#192e4e] text-[#8fa0bc]";
}

function depositedAmount(campaign: OnChainCampaign): bigint {
  if (typeof campaign.total_deposited_yocto !== "string" || !/^\d+$/.test(campaign.total_deposited_yocto)) {
    throw new Error("NEAR returned an invalid deposited amount.");
  }
  return BigInt(campaign.total_deposited_yocto);
}

function formatEndDate(timestamp: number) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(timestamp);
}

type MetricCardProps = {
  title: string;
  value: string;
  helper: string;
  icon: LucideIcon;
  trend?: string;
};

function MetricCard({
  title,
  value,
  helper,
  icon: Icon,
  trend,
}: MetricCardProps) {
  return (
    <div data-zinc-reveal className="zinc-interactive-surface min-w-0 rounded-[26px] border border-white/[0.06] bg-[#10213d] p-4 sm:p-5 shadow-[0_20px_60px_rgba(0,0,0,0.12)]">
      <div className="mb-6 flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium text-[#8fa0bc]">
            {title}
          </p>

          <div className="mt-3 flex items-end gap-2">
            <h3 className="min-w-0 break-words text-3xl font-semibold tracking-tight text-white [overflow-wrap:anywhere]">
              {value}
            </h3>

            {trend && (
              <span className="mb-1 rounded-full bg-[#183f42] px-2 py-1 text-xs font-semibold text-[#7ce6c5]">
                {trend}
              </span>
            )}
          </div>
        </div>

        <div className="ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#192e4e] text-[#ff7568]">
          <Icon size={19} />
        </div>
      </div>

      <p className="text-xs text-[#657994]">{helper}</p>
    </div>
  );
}

export default function DashboardOverview() {

  const [campaigns, setCampaigns] = useState<OnChainCampaign[] | null>(null);
  const [nftSupply, setNftSupply] = useState<string | null>(null);
  const [campaignError, setCampaignError] = useState(false);
  const [nftError, setNftError] = useState(false);
  const [refreshing, setRefreshing] = useState(true);
  const { version: refreshIndex, refresh: refreshData } = useReadRefresh();
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- External-cache invalidation starts a fresh RPC snapshot; old totals must not appear current.
    setRefreshing(true);
    setCampaigns(null);
    setNftSupply(null);
    setCampaignError(false);
    setNftError(false);
    async function load() {
      const results = await Promise.allSettled([
        getCampaigns().then((items) => {
          validateDiscoveryCampaigns(items);
          items.forEach(depositedAmount);
          if (!cancelled) setCampaigns(items);
        }),
        getNftTotalSupply().then((supply) => { if (!cancelled) setNftSupply(supply); }),
      ]);
      if (!cancelled) {
        setCampaignError(results[0].status === "rejected");
        setNftError(results[1].status === "rejected");
        setRefreshing(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [refreshIndex]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    function updateTime() {
      const current = Date.now();
      setNow(current);
      const boundaries = (campaigns ?? []).flatMap((campaign) => [campaign.start_timestamp_ms, campaign.end_timestamp_ms + 1]).filter((time) => time > current);
      if (boundaries.length) timer = setTimeout(updateTime, Math.min(Math.min(...boundaries) - current, 2_147_483_647));
    }
    updateTime();
    return () => clearTimeout(timer);
  }, [campaigns]);

  const orderedCampaigns = useMemo(() => campaigns ? [...campaigns].sort((a, b) => b.created_at_ms - a.created_at_ms || b.id - a.id) : [], [campaigns]);
  const activeCampaigns = now === null ? [] : orderedCampaigns.filter((campaign) => campaignStatus(campaign, now) === "Active");
  const selectedCampaign = activeCampaigns[0] ?? orderedCampaigns[0];
  const totalRevenue = useMemo(() => campaigns?.reduce((sum, campaign) => sum + depositedAmount(campaign), BigInt(0)) ?? null, [campaigns]);
  const revenueLabel = totalRevenue === null ? campaignError ? "Unavailable" : "Loading…" : `${yoctoToNear(totalRevenue)} NEAR`;
  const allocationData = useMemo(() => selectedCampaign ? [
    ...selectedCampaign.contributors.map((contributor, index) => ({ id: `contributor-${index}`, name: contributor.role, value: contributor.share_bps, color: allocationColors[index % allocationColors.length] })),
    { id: "treasury", name: "Project Treasury", value: selectedCampaign.treasury_share_bps, color: "#8fa0bc" },
  ] : [], [selectedCampaign]);
  const revenueData = useMemo(() => orderedCampaigns.map((campaign) => {
    const exactNear = yoctoToNear(depositedAmount(campaign));
    // Recharts needs numeric geometry; aggregation and tooltip amounts stay exact.
    return { name: `#${campaign.id}`, campaignName: campaign.name, exactNear, revenue: Number(exactNear) };
  }), [orderedCampaigns]);

  return (
    <DashboardShell
      title="Explore Zinc"
      subtitle="Public projects, revenue-right NFTs and live activity across Zinc."
      headerActions={
        <button
          type="button"
          onClick={refreshData}
          disabled={refreshing}
          className="flex items-center gap-2 rounded-xl border border-white/[0.07] bg-[#0f213d] px-4 py-3 text-sm text-[#aebbd0] transition hover:border-white/[0.12] disabled:opacity-40"
        >
          <RefreshCw size={16} className="text-[#ff7568]" />
          {refreshing ? "Refreshing..." : "Refresh data"}
        </button>
      }
    >
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#ff7568]">
                Zinc
              </p>

              <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                Explore the Zinc network
              </h2>
            </div>

            <Link
              href="/campaigns/new"
              className="flex w-fit items-center gap-2 rounded-xl border border-[#ff7568]/20 bg-[#ff7568]/10 px-4 py-3 text-sm font-semibold text-[#ff8b80] transition hover:bg-[#ff7568]/15"
            >
              <Plus size={17} />
              Create Campaign
            </Link>
          </div>

          {refreshing && <p role="status" className="mb-4 text-sm text-[#8fa0bc]">Loading live dashboard data from NEAR Testnet…</p>}
          {(campaignError || nftError) && (
            <p role="alert" className="mb-4 rounded-xl border border-[#ff7568]/20 bg-[#ff7568]/10 p-4 text-sm text-[#ff8b80]">
              {campaignError && "Could not load campaigns. "}{nftError && "Could not load the NFT supply. "}Select Refresh data to try again. Unavailable values are not shown as zero.
            </p>
          )}

          <section aria-label="Explore Zinc destinations" className="mb-6 grid gap-4 sm:grid-cols-3">
            {[["/", "Your dashboard", "See your account’s earnings, rights and projects."], ["/campaigns", "Explore projects", "Meet project contributors and inspect their allocations."], ["/gallery", "Browse revenue-right NFTs", "See real minted rights, their shares and current owners."]].map(([href, title, description]) => <Link key={href} href={href} className="zinc-interactive-surface rounded-2xl border border-[#ff7568]/20 bg-[#10213d] p-5"><h2 className="font-semibold text-[#ff9988]">{title} ↗</h2><p className="mt-3 text-sm leading-6 text-[#aebbd0]">{description}</p></Link>)}
          </section>

          <div className="mb-4 mt-8"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#ff9988]">Across all Zinc</p><h3 className="mt-2 text-xl font-semibold">Platform overview</h3><p className="mt-2 text-sm leading-6 text-[#8fa0bc]">These shared on-chain totals and public campaigns are the same for every wallet. Your personal balances are on Your dashboard.</p></div>
          <section aria-label="Platform totals" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              title="Total campaign revenue"
              value={revenueLabel}
              helper="Revenue deposited across Zinc campaigns"
              icon={CircleDollarSign}
            />

            <MetricCard
              title="Active campaigns"
              value={campaignError ? "Unavailable" : !campaigns || now === null ? "Loading…" : String(activeCampaigns.length)}
              helper="Campaigns currently accepting revenue"
              icon={Sparkles}
            />

            <MetricCard
              title="Total campaigns"
              value={campaignError ? "Unavailable" : campaigns ? String(campaigns.length) : "Loading…"}
              helper="All campaigns created on Zinc"
              icon={TrendingUp}
            />

            <MetricCard
              title="Rights NFTs issued"
              value={nftSupply ?? (nftError ? "Unavailable" : "Loading…")}
              helper="Programmable contributor revenue rights"
              icon={Users}
            />
          </section>

          <section className="mt-5 grid min-w-0 gap-5 xl:grid-cols-[minmax(0,0.82fr)_minmax(0,1.6fr)]">
            <div className="min-w-0 rounded-[28px] border border-white/[0.06] bg-[#10213d] p-4 sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 break-words">
                  <p className="text-sm font-medium text-[#8fa0bc]">
                    Revenue allocation
                  </p>

                  <h3 className="mt-1 text-lg font-semibold">
                    {selectedCampaign ? <Link href={`/campaigns/${selectedCampaign.id}`}>{selectedCampaign.name}</Link> : campaignError ? "Unavailable" : campaigns ? "No campaigns yet" : "Loading…"}
                  </h3>
                </div>

                {selectedCampaign && now !== null && <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusStyle(campaignStatus(selectedCampaign, now))}`}>{campaignStatus(selectedCampaign, now)}</span>}
              </div>

              <div className="relative mx-auto mt-5 h-[250px] max-w-[290px]">
                {selectedCampaign ? <ResponsiveContainer
                  width="100%"
                  height="100%"
                >
                  <PieChart>
                    <Pie
                      data={allocationData}
                      dataKey="value"
                      isAnimationActive={false}
                      innerRadius={76}
                      outerRadius={104}
                      paddingAngle={4}
                      stroke="transparent"
                    >
                      {allocationData.map((item) => (
                        <Cell
                          key={item.id}
                          fill={item.color}
                        />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer> : <div className="flex h-full items-center justify-center text-center text-sm text-[#7085a2]">{campaignError ? "Campaign allocation could not be loaded." : campaigns ? "Create a campaign to view its allocation." : "Loading allocation…"}</div>}

                {selectedCampaign && <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-xs text-[#7085a2]">
                    Deposited
                  </span>

                  <strong className="mt-1 max-w-[140px] break-all text-center text-xl font-semibold">
                    {yoctoToNear(depositedAmount(selectedCampaign))}
                  </strong>

                  <span className="text-xs font-semibold text-[#ff887c]">
                    NEAR
                  </span>
                </div>}
              </div>

              <div className="space-y-3">
                {allocationData.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-3 rounded-xl bg-[#0b1b34]/70 px-4 py-3"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{
                          backgroundColor: item.color,
                        }}
                      />

                      <span className="break-words text-sm text-[#aebbd0] [overflow-wrap:anywhere]">
                        {item.name}
                      </span>
                    </div>

                    <span className="shrink-0 text-sm font-semibold">
                      {item.value / 100}%
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="min-w-0 rounded-[28px] border border-white/[0.06] bg-[#10213d] p-4 sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-[#8fa0bc]">
                    Deposited revenue by campaign
                  </p>

                  <div className="mt-2 flex items-end gap-3">
                    <h3 className="min-w-0 break-words text-2xl font-semibold sm:text-3xl [overflow-wrap:anywhere]">
                      {revenueLabel}
                    </h3>

                  </div>
                </div>

                <span className="rounded-xl bg-[#0b1b34] px-3 py-2 text-xs text-[#8fa0bc]">Lifetime deposits · NEAR</span>
              </div>

              <div className="mt-8 h-[320px] w-full">
                {campaigns && campaigns.length > 0 ? <ResponsiveContainer
                  width="100%"
                  height="100%"
                >
                  <BarChart
                    data={revenueData}
                    margin={{
                      top: 10,
                      right: 0,
                      left: -25,
                      bottom: 0,
                    }}
                  >
                    <defs>
                      <linearGradient
                        id="zincBarGradient"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="#ff6d5f"
                        />

                        <stop
                          offset="100%"
                          stopColor="#ff93a2"
                        />
                      </linearGradient>
                    </defs>

                    <CartesianGrid
                      vertical={false}
                      stroke="#20314d"
                      strokeDasharray="4 8"
                    />

                    <XAxis
                      dataKey="name"
                      axisLine={false}
                      tickLine={false}
                      tick={{
                        fill: "#657994",
                        fontSize: 11,
                      }}
                      dy={10}
                    />

                    <YAxis
                      label={{ value: "NEAR", angle: -90, position: "insideLeft", fill: "#657994" }}
                      axisLine={false}
                      tickLine={false}
                      tick={{
                        fill: "#657994",
                        fontSize: 11,
                      }}
                    />

                    <Tooltip
                      cursor={{
                        fill: "rgba(255,255,255,0.025)",
                      }}
                      contentStyle={{
                        background: "#0b1b34",
                        border:
                          "1px solid rgba(255,255,255,0.08)",
                        borderRadius: "14px",
                        color: "#fff",
                      }}
                      content={({ active, payload }) => {
                        const item = payload?.[0]?.payload as (typeof revenueData)[number] | undefined;
                        return active && item ? <div className="max-w-xs break-words rounded-xl border border-white/[0.08] bg-[#0b1b34] p-3 text-sm text-white"><p>{item.campaignName}</p><p className="mt-1 break-all text-[#ff8b80]">{item.exactNear} NEAR deposited</p></div> : null;
                      }}
                    />

                    <Bar
                      dataKey="revenue"
                      isAnimationActive={false}
                      fill="url(#zincBarGradient)"
                      radius={[8, 8, 8, 8]}
                      maxBarSize={28}
                    />
                  </BarChart>
                </ResponsiveContainer> : <div className="flex h-full items-center justify-center text-sm text-[#7085a2]">{campaignError ? "Campaign revenue could not be loaded." : campaigns ? "No deposited campaign data yet." : "Loading campaign revenue…"}</div>}
              </div>
            </div>
          </section>

          <section className="mt-5 grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
            <div className="min-w-0 rounded-[28px] border border-white/[0.06] bg-[#10213d] p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-[#8fa0bc]">
                    Recent public campaigns
                  </p>

                  <h3 className="mt-1 text-lg font-semibold">
                    Campaign activity
                  </h3>
                </div>

                <Link
                  href="/campaigns"
                  className="text-sm font-medium text-[#ff8074]"
                >
                  View all
                </Link>
              </div>

              <div className="mt-5 space-y-3 md:hidden">
                {orderedCampaigns.slice(0, 5).map((campaign) => {
                  const status = now === null ? "Loading…" : campaignStatus(campaign, now);
                  return <Link key={campaign.id} href={`/campaigns/${campaign.id}`} className="block min-w-0 rounded-2xl border border-white/[0.06] bg-[#0b1b34] p-4 transition hover:border-[#ff7568]/30 focus-visible:outline-2 focus-visible:outline-[#ff8a9c]">
                    <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="break-words text-sm font-semibold [overflow-wrap:anywhere]">{campaign.name}</p><p className="mt-1 text-xs text-[#8fa0bc]">Campaign #{campaign.id}</p></div><span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ${statusStyle(status)}`}>{status}</span></div>
                    <p className="mt-4 break-all text-lg font-semibold text-[#ff9988]">{yoctoToNear(depositedAmount(campaign))} <span className="text-xs">NEAR deposited</span></p>
                    <div className="mt-3 flex flex-wrap justify-between gap-2 text-xs text-[#8fa0bc]"><span>{campaign.contributors.length} contributors</span><span>Ends {formatEndDate(campaign.end_timestamp_ms)} UTC</span></div>
                  </Link>;
                })}
                {orderedCampaigns.length === 0 && <p className="py-5 text-sm text-[#8fa0bc]">{campaignError ? "Campaigns could not be loaded. Refresh data to retry." : campaigns ? "No campaigns yet." : "Loading recent campaigns…"}</p>}
              </div>
              <div className="mt-6 hidden overflow-x-auto md:block">
                <table className="w-full min-w-[650px] text-left">
                  <thead>
                    <tr className="border-b border-white/[0.06] text-xs uppercase tracking-wider text-[#617692]">
                      <th className="pb-4 font-medium">
                        Campaign
                      </th>

                      <th className="pb-4 font-medium">
                        Status
                      </th>

                      <th className="pb-4 font-medium">
                        Revenue
                      </th>

                      <th className="pb-4 font-medium">
                        Contributors
                      </th>

                      <th className="pb-4 text-right font-medium">
                        Ends (UTC)
                      </th>
                    </tr>
                  </thead>

                  <tbody className="text-sm">
                    {orderedCampaigns.slice(0, 5).map((campaign) => {
                      const status = now === null ? "Loading…" : campaignStatus(campaign, now);
                      return (
                        <tr key={campaign.id} className="border-b border-white/[0.04]">
                          <td className="py-5 pr-3"><Link href={`/campaigns/${campaign.id}`} className="font-medium hover:text-[#ff8b80]">{campaign.name}</Link><div className="mt-1 text-xs text-[#657994]">Campaign #{campaign.id}</div></td>
                          <td className="py-5"><span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusStyle(status)}`}>{status}</span></td>
                          <td className="py-5 pr-3 font-medium">{yoctoToNear(depositedAmount(campaign))} NEAR</td>
                          <td className="py-5 text-[#a4b2c8]">{campaign.contributors.length}</td>
                          <td className="py-5 text-right text-[#a4b2c8]">{formatEndDate(campaign.end_timestamp_ms)}</td>
                        </tr>
                      );
                    })}
                    {orderedCampaigns.length === 0 && <tr><td colSpan={5} className="py-8 text-center text-[#7085a2]">{campaignError ? "Campaigns could not be loaded. Select Refresh data to retry." : campaigns ? "No campaigns yet." : "Loading recent campaigns…"}</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-[28px] border border-white/[0.06] bg-gradient-to-br from-[#142947] to-[#0f213d] p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#ff675a] to-[#ff8d9e] shadow-lg shadow-[#ff675a]/20">
                <Sparkles size={21} />
              </div>

              <p className="mt-7 text-sm font-medium text-[#ff8a7e]">
                BUILD ON NEAR
              </p>

              <h3 className="mt-2 max-w-sm text-2xl font-semibold leading-tight">
                Revenue rights that actually do something.
              </h3>

              <p className="mt-4 text-sm leading-6 text-[#7f91aa]">
                Zinc turns contributor revenue agreements into
                programmable NFTs with transparent campaign
                accounting.
              </p>

              <Link
                href="/campaigns/new"
                className="mt-8 block w-full rounded-xl border border-[#ff7568]/20 bg-[#ff7568]/10 px-4 py-3 text-center text-sm font-semibold text-[#ff8b80] transition hover:bg-[#ff7568]/15"
              >
                Create campaign
              </Link>
            </div>
          </section>

          <p className="mt-6 text-center text-xs text-[#4f6480]">
            Live NEAR Testnet contract data. Revenue totals reflect lifetime deposits.
          </p>
    </DashboardShell>
  );
}
