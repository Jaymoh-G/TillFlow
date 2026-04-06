import { tillflowFetch } from "./client";

/** @returns {Promise<{ message?: string, profile: object }>} */
export function getTenantCompanyProfileRequest(token) {
  return tillflowFetch("/tenant/company-profile", { token });
}

/** @returns {Promise<{ message?: string, profile: object }>} */
export function updateTenantCompanyProfileRequest(token, body) {
  return tillflowFetch("/tenant/company-profile", { method: "PATCH", token, body });
}
