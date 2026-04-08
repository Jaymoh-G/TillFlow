/** Base URL for the TillFlow Laravel API (no trailing slash). */
function normalizeTillflowApiBaseUrl(raw) {
  const fallback = "http://127.0.0.1:8000/api/v1";
  const initial = String(raw ?? "").trim() || fallback;
  const noTrailingSlash = initial.replace(/\/+$/, "");

  // Most TillFlow endpoints are versioned under `/api/v1`.
  // If env is configured as `/api`, upgrade it automatically.
  if (/\/api$/i.test(noTrailingSlash)) {
    return `${noTrailingSlash}/v1`;
  }
  return noTrailingSlash;
}

export const TILLFLOW_API_BASE_URL = normalizeTillflowApiBaseUrl(
  import.meta.env.VITE_TILLFLOW_API_URL
);
