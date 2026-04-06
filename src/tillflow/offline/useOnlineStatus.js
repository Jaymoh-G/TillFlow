import { useSyncExternalStore } from 'react';

function subscribe(onStoreChange) {
  window.addEventListener('online', onStoreChange);
  window.addEventListener('offline', onStoreChange);
  return () => {
    window.removeEventListener('online', onStoreChange);
    window.removeEventListener('offline', onStoreChange);
  };
}

function getOnlineSnapshot() {
  return navigator.onLine;
}

/** @returns {boolean} */
function getServerSnapshot() {
  return true;
}

/**
 * Browser online/offline from `navigator.onLine`, kept in sync via events.
 * Use for gating admin routes; do not use as proof the API is reachable.
 */
export function useOnlineStatus() {
  const isOnline = useSyncExternalStore(subscribe, getOnlineSnapshot, getServerSnapshot);
  return { isOnline, isOffline: !isOnline };
}
