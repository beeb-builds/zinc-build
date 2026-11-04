import DashboardShell from "../../components/layout/DashboardShell";
import PublicRightsGallery from "../../components/nfts/PublicRightsGallery";
import NftNavigation from "../../components/nfts/NftNavigation";

export default function GalleryPage() {
  return <DashboardShell title="Public NFT gallery" subtitle="Explore Zinc’s minted revenue-right NFTs and the projects behind them."><NftNavigation active="public" /><PublicRightsGallery /></DashboardShell>;
}
