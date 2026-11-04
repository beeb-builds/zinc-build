import DashboardShell from "../../components/layout/DashboardShell";
import ActivityFeed from "../../components/activity/ActivityFeed";

export default function TransactionsPage() {
  return <DashboardShell title="Transactions" subtitle="Real Zinc activity on NEAR Testnet">
    <div className="mx-auto max-w-7xl"><ActivityFeed /></div>
  </DashboardShell>;
}
