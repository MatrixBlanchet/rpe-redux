/**
 * Samples the live curve preview marker without rebuilding the path each frame.
 *
 * A component's flattened points and cumulative arc lengths are cached by
 * identity, so a playback frame only maps transport progress through the
 * generation's t-easing and interpolates one point. The last point is also
 * memoized by component, easing, and progress so repeated renders are free.
 */
import { easedPathProgress } from "./generation.ts";
import { flattenComponent, type CurvePathComponent, type CurvePathPoint } from "./pathModel.ts";

interface ArcTable {
  points: CurvePathPoint[];
  lengths: number[];
  total: number;
}

/** Cache counters for tests and diagnostics. */
export interface PreviewMarkerSampleStats {
  /** A component reused its cached arc table. */
  tableHits: number;
  /** A component's arc table was built. */
  tableMisses: number;
  /** A repeated (component, easing, progress) lookup reused the last point. */
  pointHits: number;
  /** A new point was interpolated. */
  samples: number;
}

const arcTables = new WeakMap<CurvePathComponent, ArcTable>();
let tableHits = 0;
let tableMisses = 0;
let pointHits = 0;
let samples = 0;
let last: {
  component: CurvePathComponent;
  tEasing: number;
  progress: number;
  point: CurvePathPoint;
} | null = null;

/** Build or return the flattened points and cumulative lengths for a component. */
function arcTable(component: CurvePathComponent): ArcTable {
  const cached = arcTables.get(component);
  if (cached) {
    tableHits += 1;
    return cached;
  }
  tableMisses += 1;
  const points = flattenComponent(component, 24);
  const lengths = [0];
  for (let index = 1; index < points.length; index += 1) {
    const left = points[index - 1];
    const right = points[index];
    lengths.push(lengths[index - 1] + Math.hypot(right.x - left.x, right.y - left.y));
  }
  const table = { points, lengths, total: lengths.at(-1) ?? 0 };
  arcTables.set(component, table);
  return table;
}

/**
 * Sample one normalized arc-length position on a component.
 *
 * The result matches `sampleComponentAt` for the same progress while reusing
 * the component's cached flattening; progress is clamped to the path.
 */
export function samplePreviewMarker(
  component: CurvePathComponent,
  tEasing: number,
  progress: number,
): CurvePathPoint | null {
  const eased = easedPathProgress(progress, tEasing);
  if (last && last.component === component && last.tEasing === tEasing && last.progress === eased) {
    pointHits += 1;
    return last.point;
  }
  const table = arcTable(component);
  if (!table.points.length) {
    return null;
  }
  if (table.points.length === 1 || table.total < 0.0001) {
    last = { component, tEasing, progress: eased, point: table.points[0] };
    samples += 1;
    return table.points[0];
  }
  const target = table.total * eased;
  let cursor = 1;
  while (cursor < table.lengths.length - 1 && table.lengths[cursor] < target) {
    cursor += 1;
  }
  const leftLength = table.lengths[cursor - 1];
  const rightLength = table.lengths[cursor];
  const amount =
    rightLength === leftLength ? 0 : (target - leftLength) / (rightLength - leftLength);
  const left = table.points[cursor - 1];
  const right = table.points[cursor];
  const point = {
    x: left.x + (right.x - left.x) * amount,
    y: left.y + (right.y - left.y) * amount,
  };
  last = { component, tEasing, progress: eased, point };
  samples += 1;
  return point;
}

/** Report marker sampling cache counters for tests and diagnostics. */
export function previewMarkerSampleStats(): PreviewMarkerSampleStats {
  return { tableHits, tableMisses, pointHits, samples };
}

/** Reset marker sampling counters; the cached arc tables stay valid. */
export function resetPreviewMarkerSampleStats(): void {
  tableHits = 0;
  tableMisses = 0;
  pointHits = 0;
  samples = 0;
  last = null;
}
