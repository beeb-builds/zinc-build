export const NEAR_NETWORK_ID = "testnet";
// Next.js inlines this public value at build time for both wallet and read calls.
// Keep the existing deployment on its original contract unless explicitly set.
export const ZINC_CONTRACT_ID = process.env.NEXT_PUBLIC_ZINC_CONTRACT_ID ?? "zinc-builder-2026.testnet";
export const NEAR_RPC_URL = "https://test.rpc.fastnear.com";
