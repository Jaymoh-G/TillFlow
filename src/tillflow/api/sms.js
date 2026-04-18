import { tillflowFetch } from "./client";

/**
 * @param {string} token
 * @param {{ to: string, message?: string }} body
 */
export function sendTestSmsRequest(token, body) {
  return tillflowFetch("/sms/test", { method: "POST", token, body });
}
