import { QueryClient } from "@tanstack/react-query";

/**
 * Default window where cached settings are considered fresh — avoids refetch on every navigation.
 * Override per-query with e.g. `staleTime: 0` when you need always-fresh data.
 */
export const DEFAULT_STALE_TIME_MS = 5 * 60 * 1000;

/**
 * Shared client for the SPA. Pattern:
 * - Load once (or per section): useQuery with `queryKey` + optional `staleTime`.
 * - Persist: useMutation with `mutationFn`; do not POST on every keystroke — save / debounce only.
 * - On success: `queryClient.setQueryData(queryKey, data)` (or `invalidateQueries`) so UI matches server.
 * - Optional: after a successful fetch or save, write the same payload to localStorage as a cold-load
 *   cache; on startup use `placeholderData` / `initialData` from localStorage, then let the query revalidate.
 *
 * Offline (TillFlow): sales/quoting routes in `tillflow/offline/tillflowOfflinePolicy.js` plus `/tillflow/pos`.
 *
 * Tenant UI settings: API `GET/PATCH /tenant/ui-settings` (see `tillflow/tenantUiSettings/`) with localStorage
 * as read-through cache; PATCH requires `tenant.manage`.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: DEFAULT_STALE_TIME_MS,
      gcTime: 30 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false
    }
  }
});
