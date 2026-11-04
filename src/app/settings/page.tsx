import DashboardShell from "../../components/layout/DashboardShell";
import SettingsPanel from "../../components/settings/SettingsPanel";

export default function SettingsPage() {
  return (
    <DashboardShell title="Settings" subtitle="Wallet connection and Zinc network information">
      <div className="mx-auto max-w-7xl"><SettingsPanel /></div>
    </DashboardShell>
  );
}
