/** React binding for the update store, shared by the badge and the settings page. */
import { useSyncExternalStore } from "react";
import { getUpdateState, subscribeUpdates, type UpdateState } from "./updateStore.ts";

/** The current update snapshot, repainted on every store change. */
export function useUpdateState(): UpdateState {
  return useSyncExternalStore(subscribeUpdates, getUpdateState, getUpdateState);
}
