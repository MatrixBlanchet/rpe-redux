/**
 * The curve-preview vector path model.
 *
 * A path is a sequence of cubic Bezier segments in chart coordinates. It
 * is editor-only data; generation samples it into ordinary moveX/moveY events
 * and never writes a trajectory structure into the chart.
 */
import { dedupePoints, simplifyPoints, straightSegments } from "./pathGeometry.ts";

/** One point in the chart's coordinate space. */
export interface CurvePathPoint {
  x: number;
  y: number;
}

/** One cubic Bezier segment, from `p0` to `p3`. */
export interface CubicSegment {
  p0: CurvePathPoint;
  p1: CurvePathPoint;
  p2: CurvePathPoint;
  p3: CurvePathPoint;
}

/** One editable path: a named, coloured cubic chain. */
export interface CurvePathComponent {
  id: string;
  name: string;
  segments: CubicSegment[];
  closed: boolean;
  color: string;
}

/** Path tools exposed by the authoring panel. */
export type CurvePathTool = "select" | "shape" | "pencil" | "connect" | "erase";

/** One open endpoint, used by the connect tool. */
export interface CurvePathEndpoint {
  componentId: string;
  atStart: boolean;
  point: CurvePathPoint;
}

/** Palette assigned to new components in creation order. */
const COLORS = ["#66d9ff", "#f7c873", "#ff8fb8", "#9fe18c", "#c7a8ff", "#ff9d74"];
let nextId = 1;

/** Allocate the next process-local curve id. */
function id(): string {
  return `curve-${nextId++}`;
}

/**
 * Raise the numeric id counter above every restored component id.
 *
 * Draft persistence can restore `curve-N` ids from an earlier session; new
 * components continue above them so each id names exactly one path.
 */
export function reserveCurveIds(components: readonly CurvePathComponent[]): void {
  let highest = nextId - 1;
  for (const component of components) {
    const match = /^curve-(\d+)$/.exec(component.id);
    if (match) {
      highest = Math.max(highest, Number(match[1]));
    }
  }
  nextId = highest + 1;
}

function point(x: number, y: number): CurvePathPoint {
  return { x, y };
}

function add(left: CurvePathPoint, right: CurvePathPoint): CurvePathPoint {
  return point(left.x + right.x, left.y + right.y);
}

function subtract(left: CurvePathPoint, right: CurvePathPoint): CurvePathPoint {
  return point(left.x - right.x, left.y - right.y);
}

function multiply(value: CurvePathPoint, scale: number): CurvePathPoint {
  return point(value.x * scale, value.y * scale);
}

function lerp(left: CurvePathPoint, right: CurvePathPoint, amount: number): CurvePathPoint {
  return point(left.x + (right.x - left.x) * amount, left.y + (right.y - left.y) * amount);
}

function distance(left: CurvePathPoint, right: CurvePathPoint): number {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

/** Shift every point in a segment list by one offset. */
function translateSegments(segments: CubicSegment[], offset: CurvePathPoint): CubicSegment[] {
  const move = (value: CurvePathPoint) => add(value, offset);
  return segments.map((segment) => ({
    p0: move(segment.p0),
    p1: move(segment.p1),
    p2: move(segment.p2),
    p3: move(segment.p3),
  }));
}

/** Build a smooth cubic chain through the supplied points. */
export function segmentsThrough(points: CurvePathPoint[], closed = false): CubicSegment[] {
  const clean = dedupePoints(points);
  if (closed && clean.length > 2 && distance(clean[0], clean[clean.length - 1]) < 1) {
    clean.pop();
  }
  if (clean.length < 2) {
    return [];
  }
  const count = closed ? clean.length : clean.length - 1;
  const segments: CubicSegment[] = [];
  for (let index = 0; index < count; index++) {
    const p0 = clean[index];
    const p3 = clean[(index + 1) % clean.length];
    const previous = closed
      ? clean[(index - 1 + clean.length) % clean.length]
      : clean[Math.max(0, index - 1)];
    const next = closed
      ? clean[(index + 2) % clean.length]
      : clean[Math.min(clean.length - 1, index + 2)];
    const p1 =
      index === 0 && !closed
        ? lerp(p0, p3, 1 / 3)
        : add(p0, multiply(subtract(p3, previous), 1 / 6));
    const p2 =
      index === count - 1 && !closed
        ? lerp(p0, p3, 2 / 3)
        : subtract(p3, multiply(subtract(next, p0), 1 / 6));
    segments.push({ p0, p1, p2, p3 });
  }
  return segments;
}

/** Allocate a component with a smooth chain and the next palette colour. */
function newComponent(name: string, points: CurvePathPoint[], closed = false): CurvePathComponent {
  return {
    id: id(),
    name,
    segments: segmentsThrough(points, closed),
    closed,
    color: COLORS[(nextId - 2) % COLORS.length],
  };
}

/** A built-in shape, stored as authored nodes plus a closed flag. */
export interface CurvePathPreset {
  id: string;
  label: string;
  closed: boolean;
  points: CurvePathPoint[];
}

/** Sample a circle outline for the preset table. */
function circlePoints(radius: number, count = 16): CurvePathPoint[] {
  return Array.from({ length: count }, (unused, index) => {
    const angle = (Math.PI * 2 * index) / count;
    return point(Math.cos(angle) * radius, Math.sin(angle) * radius);
  });
}

/** Built-in shapes offered by the authoring panel, in display order. */
const PRESETS: CurvePathPreset[] = [
  {
    id: "line",
    label: "editorPanels.curvePreview.authoring.preset.line",
    closed: false,
    points: [point(-240, 0), point(240, 0)],
  },
  {
    id: "arc",
    label: "editorPanels.curvePreview.authoring.preset.arc",
    closed: false,
    points: Array.from({ length: 7 }, (unused, index) => {
      const angle = Math.PI - (Math.PI * index) / 6;
      return point(Math.cos(angle) * 190, -Math.sin(angle) * 120);
    }),
  },
  {
    id: "s-curve",
    label: "editorPanels.curvePreview.authoring.preset.sCurve",
    closed: false,
    points: [point(-270, 90), point(-150, -100), point(0, 100), point(150, -90), point(270, 60)],
  },
  {
    id: "circle",
    label: "editorPanels.curvePreview.authoring.preset.circle",
    closed: true,
    points: circlePoints(130),
  },
  {
    id: "spiral",
    label: "editorPanels.curvePreview.authoring.preset.spiral",
    closed: false,
    points: Array.from({ length: 25 }, (unused, index) => {
      const angle = (Math.PI * 3.6 * index) / 24;
      const radius = 22 + index * 7;
      return point(Math.cos(angle) * radius, Math.sin(angle) * radius);
    }),
  },
  {
    id: "heart",
    label: "editorPanels.curvePreview.authoring.preset.heart",
    closed: true,
    points: Array.from({ length: 18 }, (unused, index) => {
      const angle = (Math.PI * 2 * index) / 18;
      return point(
        16 * Math.sin(angle) ** 3 * 13,
        -(
          13 * Math.cos(angle) -
          5 * Math.cos(angle * 2) -
          2 * Math.cos(angle * 3) -
          Math.cos(angle * 4)
        ) * 15,
      );
    }),
  },
];

/** The built-in preset shapes. */
export function curvePathPresets(): readonly CurvePathPreset[] {
  return PRESETS;
}

/** Build a new component from one preset. */
export function presetComponent(preset: CurvePathPreset): CurvePathComponent {
  return newComponent(preset.label, preset.points, preset.closed);
}

/** Build a path from sampled points; equation mode uses this conversion. */
export function componentFromPoints(
  name: string,
  points: readonly CurvePathPoint[],
  closed = false,
): CurvePathComponent | null {
  const component = newComponent(name, [...points], closed);
  return component.segments.length ? component : null;
}

/**
 * Build a component from authored nodes.
 *
 * `smooth` selects the tangent rule: smooth chains share tangents across nodes,
 * while straight tools get collinear control points at the thirds.
 */
export function componentFromNodes(
  name: string,
  points: readonly CurvePathPoint[],
  options: { closed?: boolean; smooth?: boolean } = {},
): CurvePathComponent | null {
  const clean = dedupePoints(points);
  const segments = options.smooth
    ? segmentsThrough(clean, options.closed)
    : straightSegments(clean);
  if (!segments.length) {
    return null;
  }
  return {
    id: id(),
    name,
    segments,
    closed: Boolean(options.closed),
    color: COLORS[(nextId - 2) % COLORS.length],
  };
}

/** Build a straight-edged path from clicked points (line/polyline tools). */
export function polylineComponentFromPoints(
  name: string,
  points: readonly CurvePathPoint[],
): CurvePathComponent | null {
  return componentFromNodes(name, points, { smooth: false });
}

/** Deep-copy a component under a fresh id, keeping its name and colour. */
export function cloneComponent(component: CurvePathComponent): CurvePathComponent {
  return {
    ...component,
    id: id(),
    segments: component.segments.map((segment) => ({
      p0: { ...segment.p0 },
      p1: { ...segment.p1 },
      p2: { ...segment.p2 },
      p3: { ...segment.p3 },
    })),
  };
}

/** Append a preset to the current path; a new cap starts where the old one ends. */
export function appendPreset(
  components: CurvePathComponent[],
  preset: CurvePathPreset,
): CurvePathComponent[] {
  const next = presetComponent(preset);
  if (!next.segments.length) {
    return components;
  }
  const previous = components.at(-1);
  if (!previous?.segments.length) {
    return [next];
  }
  const previousEnd = previous.segments.at(-1)?.p3;
  const nextStart = next.segments[0].p0;
  if (!previousEnd || !nextStart) {
    return [...components, next];
  }
  const translated = {
    ...next,
    segments: translateSegments(next.segments, subtract(previousEnd, nextStart)),
  };
  const merged = {
    ...previous,
    name: next.name,
    segments: [...previous.segments, ...translated.segments],
    closed: false,
    color: previous.color,
  };
  return [...components.slice(0, -1), merged];
}

/** The empty draw draft. */
export function clearComponents(): CurvePathComponent[] {
  return [];
}

/** The start and end points of an open component, or null when it has no segments. */
export function componentEndpoints(
  component: CurvePathComponent,
): [CurvePathPoint, CurvePathPoint] | null {
  if (!component.segments.length) {
    return null;
  }
  return [component.segments[0].p0, component.segments[component.segments.length - 1].p3];
}

/** The tail point when the component is open; null for a closed path. */
export function openEndpoint(component: CurvePathComponent): CurvePathPoint | null {
  return component.closed ? null : (component.segments.at(-1)?.p3 ?? null);
}

/**
 * Fit a hand-drawn stroke to a smooth cubic chain with simplified nodes.
 *
 * The stroke is decimated in chart units first so handles stay editable and the
 * generated event stream stays sparse.
 */
export function fitStroke(raw: CurvePathPoint[]): CurvePathComponent | null {
  const filtered = simplifyPoints(dedupePoints(raw, 3), 6);
  if (filtered.length < 2) {
    return null;
  }
  const closed = filtered.length > 4 && distance(filtered[0], filtered[filtered.length - 1]) < 28;
  if (closed) {
    filtered.pop();
  }
  const component = newComponent(
    "editorPanels.curvePreview.authoring.handwritten",
    filtered,
    closed,
  );
  return component.segments.length ? component : null;
}

/** Evaluate one cubic segment at `progress`, clamped to 0-1. */
export function segmentPoint(segment: CubicSegment, progress: number): CurvePathPoint {
  const t = Math.max(0, Math.min(1, progress));
  const inverse = 1 - t;
  return point(
    inverse ** 3 * segment.p0.x +
      3 * inverse ** 2 * t * segment.p1.x +
      3 * inverse * t ** 2 * segment.p2.x +
      t ** 3 * segment.p3.x,
    inverse ** 3 * segment.p0.y +
      3 * inverse ** 2 * t * segment.p1.y +
      3 * inverse * t ** 2 * segment.p2.y +
      t ** 3 * segment.p3.y,
  );
}

/** Evaluate the first derivative of a cubic segment at `progress`. */
export function segmentTangent(segment: CubicSegment, progress: number): CurvePathPoint {
  const t = Math.max(0, Math.min(1, progress));
  const inverse = 1 - t;
  return point(
    3 * inverse ** 2 * (segment.p1.x - segment.p0.x) +
      6 * inverse * t * (segment.p2.x - segment.p1.x) +
      3 * t ** 2 * (segment.p3.x - segment.p2.x),
    3 * inverse ** 2 * (segment.p1.y - segment.p0.y) +
      6 * inverse * t * (segment.p2.y - segment.p1.y) +
      3 * t ** 2 * (segment.p3.y - segment.p2.y),
  );
}

/** Split one cubic segment at `progress` without changing the visible curve. */
export function splitSegment(
  segment: CubicSegment,
  progress: number,
): [CubicSegment, CubicSegment] {
  const t = Math.max(0.01, Math.min(0.99, progress));
  const p01 = lerp(segment.p0, segment.p1, t);
  const p12 = lerp(segment.p1, segment.p2, t);
  const p23 = lerp(segment.p2, segment.p3, t);
  const p012 = lerp(p01, p12, t);
  const p123 = lerp(p12, p23, t);
  const split = lerp(p012, p123, t);
  return [
    { p0: segment.p0, p1: p01, p2: p012, p3: split },
    { p0: split, p1: p123, p2: p23, p3: segment.p3 },
  ];
}

/** One spline sample: progress, position, and distance from the target. */
export interface SegmentProjection {
  progress: number;
  point: CurvePathPoint;
  distance: number;
}

/**
 * Closest point on one cubic segment.
 *
 * The sample count follows the control polygon and the hit radius; a local
 * refinement makes the returned progress accurate enough for splitting.
 */
export function nearestPointOnSegment(
  segment: CubicSegment,
  target: CurvePathPoint,
  radius = Number.POSITIVE_INFINITY,
): SegmentProjection {
  const controlLength =
    distance(segment.p0, segment.p1) +
    distance(segment.p1, segment.p2) +
    distance(segment.p2, segment.p3);
  const spacing = Number.isFinite(radius) ? Math.max(radius * 0.45, 0.05) : 12;
  const steps = Math.min(512, Math.max(24, Math.ceil(controlLength / spacing)));
  let bestProgress = 0;
  let bestPoint = segment.p0;
  let bestDistance = distance(segment.p0, target);
  for (let sample = 1; sample <= steps; sample += 1) {
    const progress = sample / steps;
    const pointAtSample = segmentPoint(segment, progress);
    const hitDistance = distance(pointAtSample, target);
    if (hitDistance < bestDistance) {
      bestDistance = hitDistance;
      bestProgress = progress;
      bestPoint = pointAtSample;
    }
  }
  let span = 1 / steps;
  for (let round = 0; round < 3; round += 1) {
    const low = Math.max(0, bestProgress - span);
    const high = Math.min(1, bestProgress + span);
    let localProgress = bestProgress;
    let localPoint = bestPoint;
    let localDistance = bestDistance;
    for (let sample = 0; sample <= 16; sample += 1) {
      const progress = low + ((high - low) * sample) / 16;
      const pointAtSample = segmentPoint(segment, progress);
      const hitDistance = distance(pointAtSample, target);
      if (hitDistance < localDistance) {
        localDistance = hitDistance;
        localProgress = progress;
        localPoint = pointAtSample;
      }
    }
    bestProgress = localProgress;
    bestPoint = localPoint;
    bestDistance = localDistance;
    span = (high - low) / 16;
  }
  return { progress: bestProgress, point: bestPoint, distance: bestDistance };
}

/** Replace one segment with two segments that share the split point. */
export function subdivideComponent(
  component: CurvePathComponent,
  segmentIndex: number,
  progress: number,
): CurvePathComponent {
  const segment = component.segments[segmentIndex];
  if (!segment) {
    return component;
  }
  const [left, right] = splitSegment(segment, progress);
  return {
    ...component,
    segments: [
      ...component.segments.slice(0, segmentIndex),
      left,
      right,
      ...component.segments.slice(segmentIndex + 1),
    ],
  };
}

/** Flatten a component into a dense polyline for drawing and sampling. */
export function flattenComponent(component: CurvePathComponent, perSegment = 14): CurvePathPoint[] {
  const output: CurvePathPoint[] = [];
  for (const segment of component.segments) {
    for (let index = 0; index <= perSegment; index++) {
      if (index === 0 && output.length) {
        continue;
      }
      output.push(segmentPoint(segment, index / perSegment));
    }
  }
  return output;
}

/** Approximate the painted length of a component, in chart units. */
export function componentLength(component: CurvePathComponent): number {
  const points = flattenComponent(component, 20);
  let length = 0;
  for (let index = 1; index < points.length; index++) {
    length += distance(points[index - 1], points[index]);
  }
  return length;
}

/**
 * Sample a component at normalized arc-length positions.
 *
 * Each progress is clamped to `[0, 1]`; the first and last entries are exactly
 * the path endpoints. Callers that want equal spacing pass `0, 1/n, … 1`.
 */
export function sampleComponentAt(
  component: CurvePathComponent,
  progresses: readonly number[],
): CurvePathPoint[] {
  const points = flattenComponent(component, 24);
  if (points.length < 2 || progresses.length === 0) {
    return points;
  }
  const lengths = [0];
  for (let index = 1; index < points.length; index++) {
    lengths.push(lengths[index - 1] + distance(points[index - 1], points[index]));
  }
  const total = lengths[lengths.length - 1];
  if (total < 0.0001) {
    return progresses.map(() => points[0]);
  }
  return progresses.map((progress) => {
    const normalized = Number.isFinite(progress) ? Math.min(1, Math.max(0, progress)) : 0;
    const target = total * normalized;
    let cursor = 1;
    while (cursor < lengths.length - 1 && lengths[cursor] < target) {
      cursor++;
    }
    const left = lengths[cursor - 1];
    const right = lengths[cursor];
    const amount = right === left ? 0 : (target - left) / (right - left);
    return lerp(points[cursor - 1], points[cursor], amount);
  });
}

/** Sample a component at equal arc-length steps. */
export function sampleComponent(component: CurvePathComponent, count: number): CurvePathPoint[] {
  return sampleComponentAt(
    component,
    Array.from({ length: count + 1 }, (unused, index) => index / count),
  );
}

/** Point and local tangent at a normalized arc-length position, or null when empty. */
export function pointAtProgress(
  component: CurvePathComponent,
  progress: number,
): { point: CurvePathPoint; tangent: CurvePathPoint } | null {
  const points = flattenComponent(component, 20);
  if (points.length < 2) {
    return points[0] ? { point: points[0], tangent: point(1, 0) } : null;
  }
  const lengths = [0];
  for (let index = 1; index < points.length; index++) {
    lengths.push(lengths[index - 1] + distance(points[index - 1], points[index]));
  }
  const total = lengths[lengths.length - 1];
  const target = Math.max(0, Math.min(1, progress)) * total;
  let cursor = 1;
  while (cursor < lengths.length - 1 && lengths[cursor] < target) {
    cursor++;
  }
  const amount =
    lengths[cursor] === lengths[cursor - 1]
      ? 0
      : (target - lengths[cursor - 1]) / (lengths[cursor] - lengths[cursor - 1]);
  const current = lerp(points[cursor - 1], points[cursor], amount);
  return {
    point: current,
    tangent: subtract(points[cursor], points[cursor - 1]),
  };
}

/** The open endpoint nearest `target` within `radius`, or null. */
export function nearestEndpoint(
  components: CurvePathComponent[],
  target: CurvePathPoint,
  radius: number,
): CurvePathEndpoint | null {
  let found: CurvePathEndpoint | null = null;
  let best = radius;
  for (const component of components) {
    const endpoints = componentEndpoints(component);
    if (!endpoints) {
      continue;
    }
    const [start, end] = endpoints;
    if (distance(start, target) <= best) {
      best = distance(start, target);
      found = { componentId: component.id, atStart: true, point: start };
    }
    if (distance(end, target) <= best) {
      best = distance(end, target);
      found = { componentId: component.id, atStart: false, point: end };
    }
  }
  return found;
}

/** Return a component drawn in the opposite direction. */
export function reverseComponent(component: CurvePathComponent): CurvePathComponent {
  return {
    ...component,
    segments: [...component.segments].reverse().map((segment) => ({
      p0: segment.p3,
      p1: segment.p2,
      p2: segment.p1,
      p3: segment.p0,
    })),
  };
}

/** A segment address inside the draw draft. */
export interface SegmentTarget {
  componentId: string;
  segmentIndex: number;
}

/**
 * Delete exact subdivision segments and split the remaining runs.
 *
 * Segment-level erasing keeps the untouched geometry intact; a cut inside a
 * component produces one open component per contiguous run.
 */
export function deleteSegments(
  components: readonly CurvePathComponent[],
  targets: readonly SegmentTarget[],
): CurvePathComponent[] {
  const byComponent = new Map<string, Set<number>>();
  for (const target of targets) {
    const set = byComponent.get(target.componentId) ?? new Set<number>();
    set.add(target.segmentIndex);
    byComponent.set(target.componentId, set);
  }
  if (!byComponent.size) {
    return [...components];
  }
  const output: CurvePathComponent[] = [];
  for (const component of components) {
    const removed = byComponent.get(component.id);
    if (!removed?.size) {
      output.push(component);
      continue;
    }
    const runs: CubicSegment[][] = [];
    let run: CubicSegment[] = [];
    for (const [index, segment] of component.segments.entries()) {
      if (removed.has(index)) {
        if (run.length) {
          runs.push(run);
          run = [];
        }
      } else {
        run.push(segment);
      }
    }
    if (run.length) {
      runs.push(run);
    }
    runs.forEach((segments, index) => {
      output.push({
        ...component,
        // The first surviving run keeps the original id so the selection can
        // stay on the path it came from; later runs are new paths.
        id: index === 0 ? component.id : id(),
        name: index === 0 ? component.name : `${component.name} ${index + 1}`,
        segments,
        closed: false,
      });
    });
  }
  return output;
}

/** Join two open endpoints with a smooth connector and merge the components. */
export function connectEndpoints(
  components: CurvePathComponent[],
  first: CurvePathEndpoint,
  second: CurvePathEndpoint,
): CurvePathComponent[] {
  if (first.componentId === second.componentId) {
    return components;
  }
  let left = components.find((entry) => entry.id === first.componentId);
  let right = components.find((entry) => entry.id === second.componentId);
  if (!left || !right) {
    return components;
  }
  if (first.atStart) {
    left = reverseComponent(left);
  }
  if (!second.atStart) {
    right = reverseComponent(right);
  }
  const leftEnd = left.segments.at(-1)?.p3;
  const rightStart = right.segments[0]?.p0;
  if (!leftEnd || !rightStart) {
    return components;
  }
  const controlA = lerp(leftEnd, rightStart, 1 / 3);
  const controlB = lerp(leftEnd, rightStart, 2 / 3);
  const connector: CubicSegment = {
    p0: leftEnd,
    p1: controlA,
    p2: controlB,
    p3: rightStart,
  };
  const merged: CurvePathComponent = {
    ...left,
    segments: [...left.segments, connector, ...right.segments],
    closed: false,
  };
  return [...components.filter((entry) => entry.id !== left.id && entry.id !== right.id), merged];
}

/** Cut every segment touched by the eraser stroke, splitting the path into pieces. */
export function eraseComponents(
  components: CurvePathComponent[],
  stroke: CurvePathPoint[],
  radius: number,
): CurvePathComponent[] {
  if (!stroke.length) {
    return components;
  }
  const output: CurvePathComponent[] = [];
  for (const component of components) {
    const kept: CubicSegment[][] = [];
    let current: CubicSegment[] = [];
    for (const segment of component.segments) {
      const hit = Array.from({ length: 9 }, (unused, index) =>
        segmentPoint(segment, index / 8),
      ).some((sample) => stroke.some((entry) => distance(sample, entry) <= radius));
      if (hit) {
        if (current.length) {
          kept.push(current);
          current = [];
        }
      } else {
        current.push(segment);
      }
    }
    if (current.length) {
      kept.push(current);
    }
    if (kept.length === 1 && kept[0].length === component.segments.length) {
      output.push(component);
      continue;
    }
    kept.forEach((segments, index) => {
      if (segments.length) {
        output.push({
          ...component,
          id: id(),
          name: `${component.name} ${index + 1}`,
          segments,
          closed: false,
          color: component.color,
        });
      }
    });
  }
  return output;
}

/** A rough event-count estimate before simplification. */
export function estimateEvents(component: CurvePathComponent | undefined, quality: string): number {
  if (!component) {
    return 0;
  }
  const base = quality === "precise" ? 96 : quality === "smooth" ? 36 : 60;
  return Math.max(
    2,
    Math.round(base * Math.max(0.4, Math.min(3, componentLength(component) / 700))),
  );
}
