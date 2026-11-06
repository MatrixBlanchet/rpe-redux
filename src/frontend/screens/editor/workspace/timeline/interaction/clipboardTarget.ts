/** Resolves the timeline beat used by clipboard paste commands. */
import type { TimelineGestures } from "./timelineGestures.ts";
import type { TimelineViewport } from "../viewport/timelineViewport.ts";

/** Timeline state needed to resolve a paste target beat. */
export interface ClipboardTargetSurface {
  gestures: Pick<TimelineGestures, "clipboardPointer">;
  viewport: Pick<TimelineViewport, "origin" | "snappedBeat">;
}

/** Returns the snapped beat under the pointer, or the current origin without one. */
export function clipboardBeat(timeline: ClipboardTargetSurface): number {
  return timeline.gestures.clipboardPointer
    ? timeline.viewport.snappedBeat(timeline.gestures.clipboardPointer.y)
    : timeline.viewport.origin;
}
