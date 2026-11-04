import { setupWalletSelector } from "@near-wallet-selector/core";

import { setupMyNearWallet } from "@near-wallet-selector/my-near-wallet";
import { setupSender } from "@near-wallet-selector/sender";
import { setupMeteorWallet } from "@near-wallet-selector/meteor-wallet";
import { setupHotWallet } from "@near-wallet-selector/hot-wallet";
import { setupHereWallet } from "@near-wallet-selector/here-wallet";
import { setupNightly } from "@near-wallet-selector/nightly";
import { setupOKXWallet } from "@near-wallet-selector/okx-wallet";
import { setupBitgetWallet } from "@near-wallet-selector/bitget-wallet";
import { setupCoin98Wallet } from "@near-wallet-selector/coin98-wallet";
import { setupIntearWallet } from "@near-wallet-selector/intear-wallet";
import { setupNarwallets } from "@near-wallet-selector/narwallets";

import { ZINC_CONTRACT_ID } from "./near";

export async function createWalletSelector() {
  return setupWalletSelector({
    network: "testnet",

    modules: [
      setupSender(),
      setupMeteorWallet(),
      setupHotWallet(),
      setupHereWallet(),
      setupNightly(),
      setupOKXWallet(),
      setupBitgetWallet(),
      setupCoin98Wallet(),
      setupIntearWallet(),
      setupNarwallets(),
      setupMyNearWallet(),
    ],

    createAccessKeyFor: ZINC_CONTRACT_ID,
  });
}