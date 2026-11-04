import DashboardShell from "../../components/layout/DashboardShell";
import MyNfts from "../../components/nfts/MyNfts";
import NftNavigation from "../../components/nfts/NftNavigation";

export default function NftsPage() {
  return (
    <DashboardShell title="My NFTs" subtitle="Your transferable Zinc revenue rights on NEAR Testnet">
      <NftNavigation active="owned" />
      <MyNfts />
    </DashboardShell>
  );
}
