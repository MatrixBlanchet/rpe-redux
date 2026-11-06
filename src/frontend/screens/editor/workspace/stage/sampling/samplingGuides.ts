/**
 * Geometry and value mapping for the workspace sampler guides.
 *
 * The overlay paints stage-wide guide lines for XY samples, a vertical
 * scalar ruler for rotation/opacity/speed, and the two draft anchors on top of
 * them. This module owns the chart-space to stage-space conversion, the guide
 * values derived from the live camera, and the one pointer-to-sample rule.
 * The sampling session and the core sampler remain the only owners of state
 * and chart mutation.
 */
import {
  samplingGuideValues,
  samplingRangeOf,
  snapSamplingScalar,
  type SamplingAxis,
  type SamplingSettings,
  type SamplingValue,
} from "../../../../../../core/edit/sampling/sampling.ts";

/** Distance in CSS pixels under which a pointer snaps to a guide. */
export const SAMPLING_SNAP_PX = 6;

/** Default inset of the scalar ruler from the viewport's right edge. */
const RULER_INSET = 96;
/** Inset used when the viewport is too narrow for the full ruler gutter. */
const RULER_COMPACT_INSET = 24;
/** Width of the translucent ruler band. */
const RULER_BAND_WIDTH = 68;
/** Guard against a pathologically dense guide list at extreme zoom-out. */
const MAX_GUIDE_LINES = 1200;
/** Minimum screen-space distance between generated guide lines. */
const MIN_GUIDE_SPACING_PX = 3;
/** Maximum size of one outside guide segment before its opacity is sampled. */
const GUIDE_SEGMENT_PX = 64;
/** Keep a dense chart from turning every guide into an excessive SVG tree. */
const MAX_GUIDE_SEGMENTS = 24;
/** Fraction of the preview dimension kept fully visible outside its frame. */
const GUIDE_BOUNDARY_FADE_START = 0.3;
/** Fraction of the preview short side used as the pointer reveal radius. */
const GUIDE_CURSOR_REVEAL_RATIO = 0.3;

/** Screen geometry of the preview the sampler reads for one frame. */
export interface SamplingProjection {
  stageWidth: number;
  stageHeight: number;
  canvasLeft: number;
  canvasTop: number;
  centerX: number;
  centerY: number;
  scaleX: number;
  scaleY: number;
  viewportLeft: number;
  viewportTop: number;
  viewportWidth: number;
  viewportHeight: number;
  lineX: number;
  lineY: number;
  lineRotation: number;
}

/** The preview viewport inside the stage, in stage pixels. */
export interface SamplingViewport {
  left: number;
  top: number;
  width: number;
  height: number;
  right: number;
  bottom: number;
}

/** Stage-local pointer position used to reveal guides outside the preview. */
export interface SamplingGuideCursor {
  x: number;
  y: number;
}

/** One paintable portion of a guide line with its computed opacity. */
export interface SamplingGuideSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  opacity: number;
}

/** One full-viewport XY guide line. */
export interface SamplingGuideLine {
  key: string;
  /** Chart-space value the line marks. */
  value: number;
  /** Stage-space position: x for vertical lines, y for horizontal lines. */
  position: number;
  /** Every fifth guide gets a stronger stroke. */
  major: boolean;
}

/** One labelled tick on the scalar ruler. */
export interface SamplingRulerTick {
  value: number;
  y: number;
  label: string;
  major: boolean;
}

/** The vertical scale that rotation, opacity, and speed use. */
export interface SamplingRuler {
  /** Stage x of the ruler spine. */
  x: number;
  /** Stage x where the translucent band starts. */
  bandLeft: number;
  bandWidth: number;
  /** Value at the top edge of the viewport. */
  topValue: number;
  /** Value at the bottom edge of the viewport. */
  bottomValue: number;
  ticks: SamplingRulerTick[];
}

/** Everything the guide layer needs to paint one frame. */
export interface SamplingGeometry {
  vertical: SamplingGuideLine[];
  horizontal: SamplingGuideLine[];
  ruler: SamplingRuler | null;
}

/** A pointer-derived sample, its rendered anchor, and its snap outcome. */
export interface SamplingPointerSample {
  value: SamplingValue;
  /** Stage position of the (possibly snapped) anchor. */
  stage: { x: number; y: number };
  /** True when the active coordinate landed on a guide. */
  snapped: boolean;
}

/** Clamp a scalar to the inclusive unit interval. */
function unit(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * Resolve the opacity of one guide point.
 *
 * Points inside the preview stay fully visible. Outside it, a guide remains
 * fully visible for 30% of the corresponding preview dimension, then fades to
 * zero over the next 30%. The pointer adds a transparent radial reveal around
 * the cursor so nearby off-frame values remain discoverable.
 */
export function samplingGuideOpacity(
  x: number,
  y: number,
  viewport: SamplingViewport,
  cursor: SamplingGuideCursor | null,
): number {
  const outsideX = Math.max(viewport.left - x, x - viewport.right, 0);
  const outsideY = Math.max(viewport.top - y, y - viewport.bottom, 0);
  if (outsideX <= 0 && outsideY <= 0) {
    return 1;
  }
  const outsideRatio = Math.max(
    outsideX / Math.max(1, viewport.width),
    outsideY / Math.max(1, viewport.height),
  );
  const boundaryOpacity = unit(
    (GUIDE_BOUNDARY_FADE_START * 2 - outsideRatio) / GUIDE_BOUNDARY_FADE_START,
  );
  if (!cursor) {
    return boundaryOpacity;
  }
  const cursorRadius =
    Math.max(1, Math.min(viewport.width, viewport.height)) * GUIDE_CURSOR_REVEAL_RATIO;
  const cursorOpacity = unit(1 - Math.hypot(cursor.x - x, cursor.y - y) / cursorRadius);
  return Math.max(boundaryOpacity, cursorOpacity);
}

/**
 * Split a stage-wide guide into small paint segments.
 *
 * Sampling the opacity at each segment midpoint gives the outside fade a
 * smooth enough gradient without making every SVG frame depend on a CSS mask.
 */
export function samplingGuideSegments(
  position: number,
  direction: "vertical" | "horizontal",
  stageWidth: number,
  stageHeight: number,
  viewport: SamplingViewport,
  cursor: SamplingGuideCursor | null,
): SamplingGuideSegment[] {
  const length = direction === "vertical" ? stageHeight : stageWidth;
  const steps = Math.min(MAX_GUIDE_SEGMENTS, Math.max(1, Math.ceil(length / GUIDE_SEGMENT_PX)));
  const segments: SamplingGuideSegment[] = [];
  for (let index = 0; index < steps; index += 1) {
    const from = (length * index) / steps;
    const to = (length * (index + 1)) / steps;
    const middle = (from + to) / 2;
    const opacity =
      direction === "vertical"
        ? samplingGuideOpacity(position, middle, viewport, cursor)
        : samplingGuideOpacity(middle, position, viewport, cursor);
    segments.push(
      direction === "vertical"
        ? { x1: position, y1: from, x2: position, y2: to, opacity }
        : { x1: from, y1: position, x2: to, y2: position, opacity },
    );
  }
  return segments;
}

/** The viewport rectangle derived from a projection. */
export function viewportOf(projection: SamplingProjection): SamplingViewport {
  return {
    left: projection.viewportLeft,
    top: projection.viewportTop,
    width: projection.viewportWidth,
    height: projection.viewportHeight,
    right: projection.viewportLeft + projection.viewportWidth,
    bottom: projection.viewportTop + projection.viewportHeight,
  };
}

/** Convert stage pixels to chart-space coordinates. */
export function chartPointOf(
  stageX: number,
  stageY: number,
  projection: SamplingProjection,
): { x: number; y: number } {
  return {
    x: (stageX - projection.canvasLeft - projection.centerX) / Math.max(1e-6, projection.scaleX),
    y: -(stageY - projection.canvasTop - projection.centerY) / Math.max(1e-6, projection.scaleY),
  };
}

/** Convert chart-space coordinates to stage pixels. */
export function stagePointOf(
  x: number,
  y: number,
  projection: SamplingProjection,
): { x: number; y: number } {
  return {
    x: projection.canvasLeft + projection.centerX + x * projection.scaleX,
    y: projection.canvasTop + projection.centerY - y * projection.scaleY,
  };
}

/** Whether an axis uses the vertical scalar ruler instead of XY guides. */
export function isScalarAxis(axis: SamplingAxis): boolean {
  return axis === "rotation" || axis === "alpha" || axis === "speed";
}

/** The top and bottom values of the scalar ruler for one axis. */
function scalarBounds(axis: SamplingAxis): { top: number; bottom: number } {
  if (axis === "rotation") {
    // Rotation reads as a dial: 0° at the top and 360° at the bottom.
    return { top: 0, bottom: 360 };
  }
  const range = samplingRangeOf(axis);
  return { top: range.max, bottom: range.min };
}

/** Map one scalar to its stage y on the ruler. */
export function scalarToStageY(
  axis: SamplingAxis,
  value: number,
  viewport: SamplingViewport,
): number {
  const { top, bottom } = scalarBounds(axis);
  const span = top - bottom;
  if (span === 0) {
    return viewport.top + viewport.height / 2;
  }
  return viewport.top + ((top - value) / span) * viewport.height;
}

/** Map one stage y in the viewport to a raw scalar. */
export function stageYToScalar(
  axis: SamplingAxis,
  stageY: number,
  viewport: SamplingViewport,
): number {
  const { top, bottom } = scalarBounds(axis);
  const progress =
    viewport.height > 0 ? Math.min(1, Math.max(0, (stageY - viewport.top) / viewport.height)) : 0.5;
  return top + progress * (bottom - top);
}

/** Scalar distance equivalent to the snap radius, in the active axis' units. */
export function scalarTolerance(axis: SamplingAxis, viewport: SamplingViewport): number {
  if (viewport.height <= 0) {
    return 0;
  }
  const { top, bottom } = scalarBounds(axis);
  return (SAMPLING_SNAP_PX / viewport.height) * Math.abs(top - bottom);
}

/** Chart-space distance equivalent to the snap radius on one XY axis. */
export function xyTolerance(axis: "x" | "y", projection: SamplingProjection): number {
  const scale = Math.abs(axis === "x" ? projection.scaleX : projection.scaleY);
  return SAMPLING_SNAP_PX / Math.max(1e-6, scale);
}

/** Compact, unit-aware text for one scalar value. */
export function formatSamplingScalar(axis: SamplingAxis, value: number): string {
  const rounded = Math.round(value * 100) / 100;
  if (axis === "rotation") {
    return `${Number(rounded.toFixed(1))}°`;
  }
  if (axis === "alpha") {
    return String(Math.round(value));
  }
  if (axis === "speed") {
    return `${Number(rounded.toFixed(2))}×`;
  }
  return String(rounded);
}

/** The value labels the ruler prints; labels thin out when ticks get dense. */
function rulerLabel(value: number, axis: SamplingAxis): string {
  if (axis === "rotation") {
    return `${Math.round(value)}°`;
  }
  if (axis === "alpha") {
    return String(Math.round(value));
  }
  return String(Math.round(value * 100) / 100);
}

/** Build the guide set for the current projection and sampling axis. */
export function buildSamplingGeometry(
  projection: SamplingProjection,
  axis: SamplingAxis,
  settings: SamplingSettings,
): SamplingGeometry {
  const viewport = viewportOf(projection);
  if (!isScalarAxis(axis)) {
    return {
      vertical: buildXYGuides(projection, viewport, settings, "x"),
      horizontal: buildXYGuides(projection, viewport, settings, "y"),
      ruler: null,
    };
  }
  return { vertical: [], horizontal: [], ruler: buildRuler(axis, viewport, settings) };
}

/** Stage x of the scalar ruler for one viewport. */
function rulerXOf(viewport: SamplingViewport): number {
  const inset = viewport.width >= RULER_INSET * 2.3 ? RULER_INSET : RULER_COMPACT_INSET;
  return viewport.right - inset;
}

/** Build vertical or horizontal XY guide lines across the current viewport. */
function buildXYGuides(
  projection: SamplingProjection,
  viewport: SamplingViewport,
  settings: SamplingSettings,
  direction: "x" | "y",
): SamplingGuideLine[] {
  const step = Math.max(0.01, settings.guideStep);
  const lines: SamplingGuideLine[] = [];
  const start = 0;
  const end = direction === "x" ? projection.stageWidth : projection.stageHeight;
  const chartStart =
    direction === "x"
      ? chartPointOf(start, viewport.top, projection).x
      : chartPointOf(viewport.left, start, projection).y;
  const chartEnd =
    direction === "x"
      ? chartPointOf(end, viewport.bottom, projection).x
      : chartPointOf(viewport.right, end, projection).y;
  const minimum = Math.min(chartStart, chartEnd);
  const maximum = Math.max(chartStart, chartEnd);
  const firstIndex = Math.ceil(minimum / step);
  const lastIndex = Math.floor(maximum / step);
  const count = lastIndex - firstIndex + 1;
  if (count <= 0) {
    return lines;
  }
  const screenStep = Math.abs((direction === "x" ? projection.scaleX : projection.scaleY) * step);
  const pixelStride = Math.max(
    1,
    Math.ceil(MIN_GUIDE_SPACING_PX / Math.max(Number.EPSILON, screenStep)),
  );
  const countStride = Math.max(1, Math.ceil(count / MAX_GUIDE_LINES));
  const stride = Math.max(pixelStride, countStride);
  for (let index = firstIndex; index <= lastIndex; index += stride) {
    const value = index * step;
    const position =
      direction === "x"
        ? stagePointOf(value, 0, projection).x
        : stagePointOf(0, value, projection).y;
    lines.push({
      key: `${direction}:${index}`,
      value,
      position,
      major: index % 5 === 0,
    });
  }
  return lines;
}

/** Build the vertical scalar ruler and its labelled ticks. */
function buildRuler(
  axis: SamplingAxis,
  viewport: SamplingViewport,
  settings: SamplingSettings,
): SamplingRuler {
  const x = rulerXOf(viewport);
  const values = samplingGuideValues(axis, settings);
  const { top, bottom } = scalarBounds(axis);
  const ticks = values
    .map((value) => ({
      value,
      y: scalarToStageY(axis, value, viewport),
      label: rulerLabel(value, axis),
      major: areMultiples(axis, value, settings),
    }))
    .sort((left, right) => left.y - right.y);
  return {
    x,
    bandLeft: Math.max(viewport.left, x - RULER_BAND_WIDTH / 2),
    bandWidth: RULER_BAND_WIDTH,
    topValue: top,
    bottomValue: bottom,
    ticks,
  };
}

/** Whether a scalar guide is one of the labelled major steps. */
function areMultiples(axis: SamplingAxis, value: number, settings: SamplingSettings): boolean {
  if (axis === "alpha") {
    return Math.abs(value % (settings.alphaGuideStep * 5)) < 1e-6;
  }
  if (axis === "rotation") {
    return Math.abs(value % (settings.angleGuideStep * 2)) < 1e-6;
  }
  if (axis === "speed") {
    return Math.abs(value % (settings.speedGuideStep * 5)) < 1e-6;
  }
  return true;
}

/** Snap one XY coordinate to the viewport guide grid when it is close enough. */
function snapXY(
  axis: "x" | "y",
  raw: number,
  settings: SamplingSettings,
  tolerance: number,
): { value: number; snapped: boolean } {
  const step = Math.max(0.01, settings.guideStep);
  const nearest = Math.round(raw / step) * step;
  const close = settings.guidesEnabled && Math.abs(raw - nearest) <= tolerance;
  // The core sampler owns normalization; the overlay supplies the viewport
  // guide because the chart grid is camera-dependent.
  const result = snapSamplingScalar(axis, close ? nearest : raw, settings, tolerance);
  return { value: result.value, snapped: close };
}

/** Convert a client pointer to the sample for the active axis. */
export function sampleSamplingPointer(
  clientX: number,
  clientY: number,
  bounds: DOMRect,
  projection: SamplingProjection,
  axis: SamplingAxis,
  settings: SamplingSettings,
): SamplingPointerSample {
  const viewport = viewportOf(projection);
  const stageX = clientX - bounds.left;
  const stageY = clientY - bounds.top;
  if (isScalarAxis(axis)) {
    const raw = stageYToScalar(axis, stageY, viewport);
    const result = snapSamplingScalar(axis, raw, settings, scalarTolerance(axis, viewport));
    const y = scalarToStageY(axis, result.value, viewport);
    return {
      value: { axis, scalar: result.value },
      stage: { x: rulerXOf(viewport), y },
      snapped: result.snapped,
    };
  }

  const raw = chartPointOf(stageX, stageY, projection);
  const x = snapXY("x", raw.x, settings, xyTolerance("x", projection));
  const y = snapXY("y", raw.y, settings, xyTolerance("y", projection));
  return {
    value: { axis, scalar: axis === "x" ? x.value : y.value, point: { x: x.value, y: y.value } },
    stage: stagePointOf(x.value, y.value, projection),
    snapped: axis === "x" ? x.snapped : y.snapped,
  };
}

/** The rendered stage position of one draft anchor. */
export function anchorStagePoint(
  value: SamplingValue,
  projection: SamplingProjection,
  geometry: SamplingGeometry,
): { x: number; y: number } {
  if (value.axis === "x") {
    return stagePointOf(value.scalar, value.point?.y ?? 0, projection);
  }
  if (value.axis === "y") {
    return stagePointOf(value.point?.x ?? 0, value.scalar, projection);
  }
  const viewport = viewportOf(projection);
  return {
    x: geometry.ruler?.x ?? rulerXOf(viewport),
    y: scalarToStageY(value.axis, value.scalar, viewport),
  };
}
