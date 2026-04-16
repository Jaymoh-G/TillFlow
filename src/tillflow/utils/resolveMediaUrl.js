import { TILLFLOW_API_BASE_URL } from "../config";

/**
 * Resolve catalog / user media URLs: keep absolute URLs; turn `/storage/...` into
 * a full URL on the API origin so images work when the SPA is served from Vite (different host/port).
 * @param {unknown} raw
 * @returns {string|null}
 */
export function resolveMediaUrl(raw) {
  const s = String(raw ?? "").trim();
  if (!s) {
    return null;
  }
  if (/^https?:\/\//i.test(s) || s.startsWith("data:") || s.startsWith("blob:")) {
    return s;
  }
  if (s.startsWith("/")) {
    const base = String(TILLFLOW_API_BASE_URL).replace(/\/api\/v1\/?$/i, "");
    return `${base}${s}`;
  }
  return s;
}
