/** Observable room presentation state shared by chrome and the editor surface. */
import { createValue, type ValueCell } from "../state/values.ts";
import type { CollaborationState } from "./types.ts";

/** Initial presentation state before any room is opened. */
export const EMPTY_COLLABORATION_STATE: CollaborationState = Object.freeze({
  status: "idle",
  roomId: "",
  invite: "",
  serverUrl: "",
  memberId: "",
  hostId: "",
  role: "viewer",
  revision: 0,
  maxMembers: 4,
  encrypted: false,
  roomKey: "",
  members: Object.freeze([]),
  presence: Object.freeze([]),
  assets: Object.freeze([]),
  locks: Object.freeze([]),
  pending: Object.freeze([]),
  queued: 0,
  error: "",
});

/** One room per application session; chrome reads it without importing a screen. */
export const collaborationRoom: ValueCell<CollaborationState> = createValue<CollaborationState>({
  initial: EMPTY_COLLABORATION_STATE,
});

/** A room is open locally, even while a guest is waiting for approval. */
export const collaborationActive: Pick<ValueCell<boolean>, "get" | "subscribe"> = {
  get: () => {
    const state = collaborationRoom.get();
    return Boolean(state.roomId) || state.status === "waiting";
  },
  subscribe: (listener) => collaborationRoom.subscribe(listener),
};

/** Resource names whose verified bytes have not arrived yet. */
export const collaborationPendingAssets: ValueCell<readonly string[]> = createValue<
  readonly string[]
>({ initial: Object.freeze([]) });

/** Whether the provider is preparing a room before a connection exists. */
export const collaborationPreparing: ValueCell<boolean> = createValue<boolean>({ initial: false });

/** Returns whether exiting would interrupt a room or an in-progress connection. */
export function roomNeedsExitConfirmation(state: CollaborationState, preparing: boolean): boolean {
  return (
    preparing ||
    Boolean(state.roomId) ||
    ["connecting", "waiting", "connected", "reconnecting", "offline"].includes(state.status)
  );
}
