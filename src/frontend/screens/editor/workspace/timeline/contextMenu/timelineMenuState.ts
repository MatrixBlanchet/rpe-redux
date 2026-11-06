/** Owns the timeline context menu's snapshot cell and its shared surface names. */
import type { ContextMenuTarget } from "../../../../../../core/shell/registries/toolbar.ts";
import {
  createContextMenuState,
  type ContextMenuSnapshot,
} from "../../../../../overlays/contextMenu/ContextMenuPopup.tsx";

export type TimelineMenuSurface = "notes" | "events";

export interface TimelineMenuSnapshot extends ContextMenuSnapshot {
  surface: TimelineMenuSurface;
  /** The object under the pointer when the menu opened, if any. */
  target?: ContextMenuTarget;
}

/** Creates the timeline context menu's snapshot cell. */
export function createTimelineMenuState() {
  return createContextMenuState<TimelineMenuSnapshot>();
}
