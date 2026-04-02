import { useSyncExternalStore } from "react";
import {
  getServerSnapshot,
  loadStores,
  subscribeStores
} from "./storesRegistry";

export function useStores() {
  return useSyncExternalStore(subscribeStores, loadStores, getServerSnapshot);
}
