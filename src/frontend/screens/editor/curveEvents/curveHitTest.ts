/**
 * Screen-space picking for the curve draft.
 *
 * The overlay owns paint; this module owns "what would the pointer grab".
 * Every candidate is converted to screen coordinates before it is compared,
 * so a chart-space grid snap or an aspect-ratio stretch can never move a hit
 * target away from the pixels the user actually sees.
 */
import {
  overlayToScreen,
  rotationGeometry,
  type OverlayHandle,
  type OverlayView,
} from "./drawOverlay.ts";
import {
  nearestPointOnSegment,
  type CurvePathComponent,
  type CurvePathPoint,
} from "./pathModel.ts";
import { componentVisualBounds, segmentControlBounds } from "./pathBounds.ts";

/** Pointer radius for nodes, control handles, and path strokes. */
export const CURVE_HIT_RADIUS = 11;
/** The rotation handle has its own, slightly larger, screen radius. */
const ROTATION_HIT_RADIUS = 12;
/** Grabbable thickness of the selection frame, in screen pixels. */
export const CURVE_FRAME_HIT_BAND = 7;

/** What the pointer resolved to, in paint order. */
export type CurvePick =
  | { kind: "rotate" }
  | { kind: "handle"; handle: OverlayHandle; handleKind: "node" | "control" }
  | { kind: "frame" }
  | {
      kind: "path";
      componentId: string;
      segmentIndex: number;
      progress: number;
      point: CurvePathPoint;
    }
  | { kind: "empty" };

/** One handle within the hit radius, with its screen distance. */
interface HandleCandidate {
  handle: OverlayHandle;
  handleKind: "node" | "control";
  distance: number;
}

function screenDistance(left: CurvePathPoint, right: CurvePathPoint): number {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

/** Segment-level work counters for tests and pointer-latency diagnostics. */
export interface CurveHitTestStats {
  /** Segments that entered the adaptive nearest-point sampler. */
  segmentsTested: number;
  /** Segments rejected by their control-polygon bounds. */
  segmentsSkipped: number;
}

let segmentsTested = 0;
let segmentsSkipped = 0;

/** Report the segment counters since the last reset. */
export function curveHitTestStats(): CurveHitTestStats {
  return { segmentsTested, segmentsSkipped };
}

/** Reset the segment counters; caches stay valid. */
export function resetCurveHitTestStats(): void {
  segmentsTested = 0;
  segmentsSkipped = 0;
}

/** The nearest node or control handle inside the cursor radius. */
function nearestHandle(
  component: CurvePathComponent,
  cursor: CurvePathPoint,
  view: OverlayView,
  radius: number,
): HandleCandidate | null {
  let bestNode: HandleCandidate | null = null;
  let bestControl: HandleCandidate | null = null;
  for (const [segmentIndex, segment] of component.segments.entries()) {
    for (const field of ["p1", "p2", "p0", "p3"] as const) {
      const point = segment[field];
      const distance = screenDistance(overlayToScreen(view, point), cursor);
      if (distance > radius) {
        continue;
      }
      const handleKind = field === "p1" || field === "p2" ? "control" : "node";
      const candidate: HandleCandidate = {
        handle: { segmentIndex, field, kind: handleKind, point },
        handleKind,
        distance,
      };
      if (handleKind === "node") {
        if (!bestNode || distance < bestNode.distance) {
          bestNode = candidate;
        }
      } else if (!bestControl || distance < bestControl.distance) {
        bestControl = candidate;
      }
    }
  }
  if (!bestNode) {
    return bestControl;
  }
  if (!bestControl) {
    return bestNode;
  }
  // A node and a control handle can overlap at a segment end. The node is the
  // structural anchor, so it wins the near-tie; a clearly closer control wins
  // because that is where the user aimed.
  return bestNode.distance <= bestControl.distance + 2 ? bestNode : bestControl;
}

/** Whether the cursor is on the selection frame's outer grip band. */
function onSelectionFrame(
  component: CurvePathComponent,
  cursor: CurvePathPoint,
  view: OverlayView,
  band: number,
): boolean {
  const bounds = componentVisualBounds(component);
  if (!bounds) {
    return false;
  }
  const topLeft = overlayToScreen(view, { x: bounds.left, y: bounds.top });
  const bottomRight = overlayToScreen(view, { x: bounds.right, y: bounds.bottom });
  const left = Math.min(topLeft.x, bottomRight.x);
  const right = Math.max(topLeft.x, bottomRight.x);
  const top = Math.min(topLeft.y, bottomRight.y);
  const bottom = Math.max(topLeft.y, bottomRight.y);
  if (
    cursor.x < left - band ||
    cursor.x > right + band ||
    cursor.y < top - band ||
    cursor.y > bottom + band
  ) {
    return false;
  }
  // The ring outside the visual bounds is the grip. The curve itself keeps
  // priority, so a flat path's frame cannot steal a segment click.
  const insideBounds =
    cursor.x >= left && cursor.x <= right && cursor.y >= top && cursor.y <= bottom;
  return !insideBounds;
}

/** The closest path stroke within the cursor radius, with its segment and progress. */
function nearestPath(
  components: readonly CurvePathComponent[],
  point: CurvePathPoint,
  cursor: CurvePathPoint,
  view: OverlayView,
  radius: number,
): (CurvePick & { kind: "path" }) | null {
  const scale = Math.min(view.scaleX ?? view.scale, view.scaleY ?? view.scale);
  const chartRadius = radius / Math.max(0.0001, scale);
  let best: (CurvePick & { kind: "path" }) | null = null;
  let bestDistance = radius;
  for (const component of components) {
    // Cached visual bounds give a cheap screen-space cull before the adaptive
    // segment sampler runs.
    const bounds = componentVisualBounds(component);
    if (bounds) {
      const topLeft = overlayToScreen(view, { x: bounds.left, y: bounds.top });
      const bottomRight = overlayToScreen(view, { x: bounds.right, y: bounds.bottom });
      const left = Math.min(topLeft.x, bottomRight.x) - radius;
      const right = Math.max(topLeft.x, bottomRight.x) + radius;
      const top = Math.min(topLeft.y, bottomRight.y) - radius;
      const bottom = Math.max(topLeft.y, bottomRight.y) + radius;
      if (cursor.x < left || cursor.x > right || cursor.y < top || cursor.y > bottom) {
        continue;
      }
    }
    for (const [segmentIndex, segment] of component.segments.entries()) {
      // The component cull still admits every segment of a path whose bounds
      // contain the cursor. A segment whose control polygon (expanded by the
      // chart-space hit radius) misses the cursor cannot be hit, so the adaptive
      // sampler only runs for the few candidates near the pointer.
      const bounds = segmentControlBounds(segment);
      if (
        point.x < bounds.left - chartRadius ||
        point.x > bounds.right + chartRadius ||
        point.y < bounds.bottom - chartRadius ||
        point.y > bounds.top + chartRadius
      ) {
        segmentsSkipped += 1;
        continue;
      }
      segmentsTested += 1;
      const projection = nearestPointOnSegment(segment, point, chartRadius);
      if (projection.distance > chartRadius) {
        continue;
      }
      const distance = screenDistance(overlayToScreen(view, projection.point), cursor);
      if (distance <= bestDistance) {
        bestDistance = distance;
        best = {
          kind: "path",
          componentId: component.id,
          segmentIndex,
          progress: projection.progress,
          point: projection.point,
        };
      }
    }
  }
  return best;
}

/**
 * Resolve the pointer target in the same order the overlay paints:
 * rotation, node/control, selection frame, path stroke, then empty canvas.
 */
export function pickCurveTarget(options: {
  components: readonly CurvePathComponent[];
  selectedId: string | null;
  point: CurvePathPoint;
  view: OverlayView;
  radius?: number;
  frameBand?: number;
}): CurvePick {
  const { components, selectedId, point, view } = options;
  const radius = options.radius ?? CURVE_HIT_RADIUS;
  const frameBand = options.frameBand ?? CURVE_FRAME_HIT_BAND;
  const cursor = overlayToScreen(view, point);
  const selected = selectedId
    ? components.find((component) => component.id === selectedId)
    : undefined;
  if (selected) {
    const rotation = rotationGeometry(selected, view);
    if (rotation) {
      const handle = overlayToScreen(view, rotation.handle);
      if (screenDistance(handle, cursor) <= ROTATION_HIT_RADIUS) {
        return { kind: "rotate" };
      }
    }
    const handle = nearestHandle(selected, cursor, view, radius);
    if (handle) {
      return { kind: "handle", handle: handle.handle, handleKind: handle.handleKind };
    }
    if (onSelectionFrame(selected, cursor, view, frameBand)) {
      return { kind: "frame" };
    }
  }
  return nearestPath(components, point, cursor, view, radius) ?? { kind: "empty" };
}
