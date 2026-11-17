/**
 * Event-bar edge drags: the head or tail that a pointer gesture trims.
 *
 * The helper owns only the drag geometry and the selected edge's beat anchor; the
 * canvas interaction decides when a press means an edge edit and commits it.
 */
import { eventKey, eventListAt } from "../../../../../../core/edit/events/eventTracks.ts";
import type { EditorSession } from "../../../../../../core/edit/session/session.ts";
import type {
  TimelineEventDrag,
  TimelineEventRect,
  TimelinePoint,
} from "../../../../../../core/edit/timeline/types.ts";
import type { TimelineViewport } from "../viewport/timelineViewport.ts";

/** The timeline surface an event edge drag reads. */
interface EdgeTimeline {
  getSession(): EditorSession;
  viewport: Pick<TimelineViewport, "tempo" | "origin" | "factorForLine">;
}

/** The edge a press is close enough to trim, or null for the bar body. */
export function eventEdgeAt(
  rectangle: TimelineEventRect,
  point: TimelinePoint,
): "startTime" | "endTime" | null {
  if (Math.abs(point.y - (rectangle.y + rectangle.height)) <= 8) {
    return "startTime";
  }
  if (Math.abs(point.y - rectangle.y) <= 8) {
    return "endTime";
  }
  return null;
}

/** Select one event for an edge drag without toggling Ctrl multi-selection. */
export function selectEventEdgeTarget(session: EditorSession, rectangle: TimelineEventRect): void {
  const lineIndex = rectangle.lineIndex ?? session.lineIndex;
  const key = eventKey(rectangle.type, rectangle.index);
  session.focus = "events";
  if (
    session.multiLineActive &&
    session.multiLineMode === "events" &&
    session.multiEventSelection
  ) {
    session.multiEventSelection.set(lineIndex, new Set([key]));
  }
  session.eventSelection = new Set([key]);
  session.selectionMode = "single";
}

/**
 * Build a head or tail drag for the event rectangle under the pointer.
 *
 * The anchor is the moved edge's own beat, so the drag delta is measured from
 * that edge. A missing event or a stale rectangle yields null and arms nothing.
 */
export function eventEdgeDragFor(
  timeline: EdgeTimeline,
  rectangle: TimelineEventRect,
  point: TimelinePoint,
  kind: "startTime" | "endTime",
  pointerId: number,
): TimelineEventDrag | null {
  const session = timeline.getSession();
  const lineIndex = rectangle.lineIndex ?? session.lineIndex;
  const target = eventListAt(session, lineIndex, rectangle.type, session.eventLayer)[
    rectangle.index
  ];
  if (!target) {
    return null;
  }
  return {
    kind,
    type: rectangle.type,
    anchor: kind === "endTime" ? target.endTime : target.startTime,
    lineIndex,
    pointerId,
    start: point,
    current: point,
    startFactor: timeline.viewport.factorForLine(lineIndex),
    originSeconds: timeline.viewport.tempo.seconds(
      timeline.viewport.origin,
      timeline.viewport.factorForLine(lineIndex),
    ),
  };
}
