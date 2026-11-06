/**
 * Point and cubic-segment geometry shared by the curve trajectory draft.
 *
 * These operations only inspect coordinates: decimation, straight segments,
 * simplification, and rotation. Path identity and colours stay in `pathModel`.
 */
import type { CubicSegment, CurvePathComponent, CurvePathPoint } from "./pathModel.ts";

function point(x: number, y: number): CurvePathPoint {
  return { x, y };
}

function lerp(left: CurvePathPoint, right: CurvePathPoint, amount: number): CurvePathPoint {
  return point(left.x + (right.x - left.x) * amount, left.y + (right.y - left.y) * amount);
}

function distance(left: CurvePathPoint, right: CurvePathPoint): number {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

/** Drop points that are closer together than the drawing resolution. */
export function dedupePoints(points: readonly CurvePathPoint[], minimum = 1): CurvePathPoint[] {
  const clean: CurvePathPoint[] = [];
  for (const entry of points) {
    if (!clean.length || distance(clean[clean.length - 1], entry) > minimum) {
      clean.push(entry);
    }
  }
  return clean;
}

/** Straight cubic segments: a line is the degenerate Bezier every path tool shares. */
export function straightSegments(points: readonly CurvePathPoint[]): CubicSegment[] {
  const clean = dedupePoints(points);
  if (clean.length < 2) {
    return [];
  }
  return clean.slice(0, -1).map((p0, index) => {
    const p3 = clean[index + 1];
    return { p0, p1: lerp(p0, p3, 1 / 3), p2: lerp(p0, p3, 2 / 3), p3 };
  });
}

/**
 * Ramer-Douglas-Peucker simplification in chart units.
 *
 * A freehand stroke arrives at pointer-event density; the tolerance keeps the
 * nodes that shape it and drops the rest. The result is independent of zoom.
 */
export function simplifyPoints(
  points: readonly CurvePathPoint[],
  tolerance: number,
): CurvePathPoint[] {
  if (points.length < 3 || tolerance <= 0) {
    return [...points];
  }
  const left = points[0];
  const right = points[points.length - 1];
  let farthest = -1;
  let farthestDistance = tolerance;
  for (let index = 1; index < points.length - 1; index += 1) {
    const entry = points[index];
    const spanX = right.x - left.x;
    const spanY = right.y - left.y;
    const length = Math.hypot(spanX, spanY);
    const offset =
      length < 0.001
        ? distance(entry, left)
        : Math.abs(spanY * entry.x - spanX * entry.y + right.x * left.y - right.y * left.x) /
          length;
    if (offset > farthestDistance) {
      farthestDistance = offset;
      farthest = index;
    }
  }
  if (farthest < 0) {
    return [left, right];
  }
  const head = simplifyPoints(points.slice(0, farthest + 1), tolerance);
  const tail = simplifyPoints(points.slice(farthest), tolerance);
  return [...head.slice(0, -1), ...tail];
}

/** Rotate one component around a chart-space centre by `radians`. */
export function rotateComponent(
  component: CurvePathComponent,
  center: CurvePathPoint,
  radians: number,
): CurvePathComponent {
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const turn = (entry: CurvePathPoint) => {
    const x = entry.x - center.x;
    const y = entry.y - center.y;
    return point(center.x + x * cos - y * sin, center.y + x * sin + y * cos);
  };
  return {
    ...component,
    segments: component.segments.map((segment) => ({
      p0: turn(segment.p0),
      p1: turn(segment.p1),
      p2: turn(segment.p2),
      p3: turn(segment.p3),
    })),
  };
}
