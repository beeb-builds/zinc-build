export type TransactionUpdate = { phase: "preparing" | "wallet" | "verifying"; hash?: string };
export type TransactionObserver = (update: TransactionUpdate) => void;

export function reportTransaction(observer: TransactionObserver | undefined, update: TransactionUpdate) {
  // Presentation must not interrupt a signed transaction or its verification.
  try { observer?.(update); } catch { /* Ignore presentation errors. */ }
}
