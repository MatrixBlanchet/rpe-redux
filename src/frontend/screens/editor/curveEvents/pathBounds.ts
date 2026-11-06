/**
 * Visual bounds for one curve draft component.
 *
 * Selection frames, rotation handles, and frame hit tests use the same flattened
 * samples as the preview and the event generator. Bounds are cached per component
 * identity because components are replaced, not mutated, on every edit.
 */
import { flattenComponent, type CubicSegment, type CurvePathComponent } from "./pathModel.ts";

/** Bounds in chart coordinates; `top` is the larger Y because chart Y points up. */
export interface VisualBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * The flattened outer edges of one component, or null when it has no segments.
 *
 * The result is cached by component identity; replacing the component object
 * invalidates it.
 */
const boundsCache = new WeakMap<CurvePathComponent, VisualBounds | null>();
const segmentBoundsCache = new WeakMap<CubicSegment, VisualBounds>();

/** Return the visual bounds of a component, using the per-identity cache. */
export function componentVisualBounds(component: CurvePathComponent): VisualBounds | null {
  const cached = boundsCache.get(component);
  if (cached !== undefined) {
    return cached;
  }
  const points = flattenComponent(component, 16);
  if (!points.length) {
    boundsCache.set(component, null);
    return null;
  }
  let left = Infinity;
  let top = -Infinity;
  let right = -Infinity;
  let bottom = Infinity;
  for (const entry of points) {
    left = Math.min(left, entry.x);
    top = Math.max(top, entry.y);
    right = Math.max(right, entry.x);
    bottom = Math.min(bottom, entry.y);
  }
  const bounds = { left, top, right, bottom };
  boundsCache.set(component, bounds);
  return bounds;
}

/**
 * Bounds of one segment's control polygon.
 *
 * A cubic Bezier lies inside the convex hull of its control points, so a
 * pointer outside this box expanded by the hit radius cannot reach the curve.
 * The result is cached by segment identity because edits replace segments.
 */
export function segmentControlBounds(segment: CubicSegment): VisualBounds {
  const cached = segmentBoundsCache.get(segment);
  if (cached) {
    return cached;
  }
  let left = Infinity;
  let top = -Infinity;
  let right = -Infinity;
  let bottom = Infinity;
  for (const point of [segment.p0, segment.p1, segment.p2, segment.p3]) {
    left = Math.min(left, point.x);
    top = Math.max(top, point.y);
    right = Math.max(right, point.x);
    bottom = Math.min(bottom, point.y);
  }
  const bounds = { left, top, right, bottom };
  segmentBoundsCache.set(segment, bounds);
  return bounds;
}
