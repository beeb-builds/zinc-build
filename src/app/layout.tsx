import type { Metadata } from "next";
import "@near-wallet-selector/modal-ui/styles.css";
import "./globals.css";

import { WalletProvider } from "../components/wallet/WalletProvider";
import ReadCacheSync from "../components/data/ReadCacheSync";

export const metadata: Metadata = {
  title: "Zinc — Programmable Revenue Rights",
  description:
    "Campaign-based programmable NFT revenue rights built on NEAR Protocol.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <WalletProvider><ReadCacheSync />{children}</WalletProvider>
      </body>
    </html>
  );
}
