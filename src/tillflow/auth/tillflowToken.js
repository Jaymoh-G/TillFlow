/** Same key and read order as `AuthContext` (localStorage first, then sessionStorage). */
export const TILLFLOW_TOKEN_KEY = "tillflow_sanctum_token";

export function readTillflowStoredToken() {
  try {
    if (typeof localStorage !== "undefined") {
      const fromLocal = localStorage.getItem(TILLFLOW_TOKEN_KEY);
      if (fromLocal) {
        return fromLocal;
      }
    }
    if (typeof sessionStorage !== "undefined") {
      return sessionStorage.getItem(TILLFLOW_TOKEN_KEY);
    }
  } catch {
    return null;
  }
  return null;
}
