/** Room role rules that are independent of transport and React. */
import { roomPermissions } from "./permissions.ts";
import type { CollaborationRole } from "./types.ts";

/** Whether a room is open and whether this client may only read. */
export interface CollaborationAccess {
  readonly active: boolean;
  readonly readOnly: boolean;
}

/** An idle client is never read-only: it simply has no room authority. */
export function collaborationAccess(roomId: string, role: CollaborationRole): CollaborationAccess {
  const active = Boolean(roomId);
  return { active, readOnly: active && !roomPermissions(role).editChart };
}
