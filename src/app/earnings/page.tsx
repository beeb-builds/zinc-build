import DashboardShell from "../../components/layout/DashboardShell";
import WalletEarnings from "../../components/earnings/WalletEarnings";

export default function EarningsPage() {
  return <DashboardShell title="Earnings" subtitle="Your current and historical Zinc campaign revenue">
    <div className="mx-auto max-w-7xl"><WalletEarnings /></div>
  </DashboardShell>;
}
