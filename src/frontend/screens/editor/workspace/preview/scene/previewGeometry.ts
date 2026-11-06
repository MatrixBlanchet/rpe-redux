/**
 * Caches preview hit geometry until the chart, revision, time, or viewport
 * changes. The preview owns the cache lifetime; the core hit-test contract owns
 * the result shape consumers read.
 */
import type { Chart } from "../../../../../../core/global/chart/chart.ts";
import type { HitTestPreviewGeometry } from "../../../../../../core/edit/hitTest/api.ts";
import type { PreviewViewport } from "./viewport.ts";

/** One chart, revision, time, and viewport combination the cache can answer for. */
export interface PreviewGeometryKey {
  chart: Chart;
  revision: number;
  seconds: number;
  width: number;
  height: number;
  scale: number;
  scaleX: number;
  scaleY: number;
  devicePixelRatio: number;
  // The painted rectangle, in the same screen space as the hit geometry.
  viewport: PreviewViewport;
}

/** Whether two viewports paint the same rectangle at the same scale. */
function sameViewport(left: PreviewViewport, right: PreviewViewport): boolean {
  return (
    left.left === right.left &&
    left.top === right.top &&
    left.width === right.width &&
    left.height === right.height &&
    left.scale === right.scale &&
    left.scaleX === right.scaleX &&
    left.scaleY === right.scaleY
  );
}

/** Whether two keys describe the same painted frame. */
function sameKey(left: PreviewGeometryKey, right: PreviewGeometryKey): boolean {
  return (
    left.chart === right.chart &&
    left.revision === right.revision &&
    left.seconds === right.seconds &&
    left.width === right.width &&
    left.height === right.height &&
    left.scale === right.scale &&
    left.scaleX === right.scaleX &&
    left.scaleY === right.scaleY &&
    left.devicePixelRatio === right.devicePixelRatio &&
    sameViewport(left.viewport, right.viewport)
  );
}

/** Small identity cache for expensive preview collision geometry. */
export class PreviewGeometryCache {
  private entry: { key: PreviewGeometryKey; value: HitTestPreviewGeometry } | null = null;

  /** Returns the cached geometry when the key still matches, otherwise null. */
  get(key: PreviewGeometryKey): HitTestPreviewGeometry | null {
    return this.entry && sameKey(this.entry.key, key) ? this.entry.value : null;
  }

  /** Replaces the single cached entry with this key and geometry. */
  set(key: PreviewGeometryKey, value: HitTestPreviewGeometry): void {
    this.entry = { key, value };
  }

  /** Drops the cached geometry without changing the cache lifetime. */
  clear(): void {
    this.entry = null;
  }
}
