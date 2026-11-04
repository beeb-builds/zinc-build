import DashboardShell from "../../components/layout/DashboardShell";

export default function LoadingCampaigns() {
  return <DashboardShell title="Campaigns" subtitle="Programmable revenue rights on NEAR">
    <p role="status" className="text-sm text-[#A9B6CF]">Loading campaigns from NEAR Testnet...</p>
    <div aria-hidden="true" className="mt-6 grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
      {[0, 1, 2].map((item) => <div key={item} className="h-72 rounded-2xl border border-[#293954] bg-[#122344] motion-safe:animate-pulse" />)}
    </div>
  </DashboardShell>;
}
