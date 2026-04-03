import { onlineOrderData } from "./onlineOrderData";

const CHANNELS = ["Web checkout", "Mobile app", "Marketplace"];

/** Online / e-commerce orders — same base shape as catalog, distinct refs + channel. */
export const webOrderData = onlineOrderData.map((row, i) => ({
  ...row,
  id: `web-${row.id}`,
  reference: `ONL-${String(i + 1).padStart(3, "0")}`,
  channel: CHANNELS[i % CHANNELS.length]
}));
