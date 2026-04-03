import { onlineOrderData } from "./onlineOrderData";

/** POS register receipts — same shape as online orders, POS reference + terminal. */
export const posOrderData = onlineOrderData.map((row, i) => ({
  ...row,
  id: `pos-${row.id}`,
  reference: `POS-${String(i + 1).padStart(3, "0")}`,
  terminal: `Register ${(i % 4) + 1}`
}));
