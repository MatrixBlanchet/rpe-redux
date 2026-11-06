/**
 * Texture alignment, hold geometry, and skew sampling shared by preview,
 * timeline, and hit testing. Pure geometry: callers supply measured textures or
 * line controls and receive quads, intervals, or shear values, with no canvas
 * state involved.
 */
import { ControlCurve } from "../../../../core/global/chart/runtime/scene.ts";
import type { JudgeLine, JudgeLineNote } from "../../../../core/global/chart/chart.ts";

export interface NoteTextureMetrics {
  readonly textureWidth: number;
  readonly textureHeight: number;
  readonly usefulX: number;
  readonly usefulY: number;
  readonly usefulWidth: number;
  readonly usefulHeight: number;
}

export interface AlignedTextureQuad {
  readonly centerOffsetX: number;
  readonly centerOffsetY: number;
  readonly width: number;
  readonly height: number;
  readonly u0: number;
  readonly v0: number;
  readonly u1: number;
  readonly v1: number;
}

export interface AlignedTextureOptions {
  /**
   * Mirror the texture's V axis. Hold art is authored head-down while a quad's
   * local +Y points from head to tail, so flipping V lands the authored head on
   * the quad's head edge.
   */
  readonly flipV?: boolean;
}

export interface HoldUsefulInterval {
  readonly head: { x: number; y: number };
  readonly tail: { x: number; y: number };
}

/** Extend a Hold's anchor segment to the useful intervals of its head and tail caps. */
export function holdUsefulInterval(area: {
  readonly head: { x: number; y: number };
  readonly tail: { x: number; y: number };
  readonly headLength?: number;
  readonly tailLength?: number;
}): HoldUsefulInterval {
  const deltaX = area.tail.x - area.head.x;
  const deltaY = area.tail.y - area.head.y;
  const length = Math.hypot(deltaX, deltaY);
  if (length <= 0) {
    return { head: { ...area.head }, tail: { ...area.tail } };
  }
  const unitX = deltaX / length;
  const unitY = deltaY / length;
  const headInset = Math.max(0, area.headLength ?? 0) / 2;
  const tailInset = Math.max(0, area.tailLength ?? 0) / 2;
  return {
    head: { x: area.head.x - unitX * headInset, y: area.head.y - unitY * headInset },
    tail: { x: area.tail.x + unitX * tailInset, y: area.tail.y + unitY * tailInset },
  };
}

/** Resolve the complete texture quad aligned by its useful area. */
export function alignedTextureQuad(
  metrics: NoteTextureMetrics,
  logicalWidth: number,
  logicalHeight: number,
  options: AlignedTextureOptions = {},
): AlignedTextureQuad | null {
  if (
    logicalWidth <= 0 ||
    logicalHeight <= 0 ||
    metrics.textureWidth <= 0 ||
    metrics.textureHeight <= 0 ||
    metrics.usefulWidth <= 0 ||
    metrics.usefulHeight <= 0
  ) {
    return null;
  }
  const flipV = options.flipV === true;
  const scaleX = logicalWidth / metrics.usefulWidth;
  const scaleY = logicalHeight / metrics.usefulHeight;
  const width = metrics.textureWidth * scaleX;
  const height = metrics.textureHeight * scaleY;
  const centerOffsetY = -logicalHeight / 2 - metrics.usefulY * scaleY + height / 2;
  return {
    centerOffsetX: -logicalWidth / 2 - metrics.usefulX * scaleX + width / 2,
    // Mirroring V moves the useful rows to the other half of the full texture,
    // so the shift that keeps those rows centred on the logical box mirrors too.
    centerOffsetY: flipV ? (centerOffsetY === 0 ? 0 : -centerOffsetY) : centerOffsetY,
    width,
    height,
    u0: 0,
    v0: flipV ? 1 : 0,
    u1: 1,
    v1: flipV ? 0 : 1,
  };
}

/** Inset a Hold body so its useful edges meet the cap useful edges. */
export function holdBodySegment(
  headX: number,
  headY: number,
  tailX: number,
  tailY: number,
  headCapLength: number,
  tailCapLength = headCapLength,
): { headX: number; headY: number; tailX: number; tailY: number } {
  const deltaX = tailX - headX;
  const deltaY = tailY - headY;
  const length = Math.hypot(deltaX, deltaY);
  if (length <= 0) {
    return { headX, headY, tailX, tailY };
  }
  const totalInset = Math.min(
    length,
    Math.max(0, headCapLength / 2) + Math.max(0, tailCapLength / 2),
  );
  const headInset = totalInset
    ? (Math.min(length / 2, Math.max(0, headCapLength / 2)) /
        (headCapLength / 2 + tailCapLength / 2 || 1)) *
      totalInset
    : 0;
  const tailInset = totalInset - headInset;
  const unitX = deltaX / length;
  const unitY = deltaY / length;
  return {
    headX: headX + unitX * headInset,
    headY: headY + unitY * headInset,
    tailX: tailX - unitX * tailInset,
    tailY: tailY - unitY * tailInset,
  };
}

/**
 * Rotation that maps a texture's local +Y axis onto the Hold head-to-tail
 * vector: `atan2(headX - tailX, tailY - headY)`.
 */
export function holdAxisRotation(
  headX: number,
  headY: number,
  tailX: number,
  tailY: number,
): number {
  return Math.atan2(headX - tailX, tailY - headY);
}

/**
 * The angle used to draw a Hold, including the no-body case.
 *
 * A speed-zero Hold, or one whose tail has reached the line, has no head-to-tail
 * axis, so `holdAxisRotation` would be zero; the caller's line angle is used
 * instead.
 */
export function holdRenderRotation(
  headX: number,
  headY: number,
  tailX: number,
  tailY: number,
  fallbackRotation: number,
): number {
  return Math.hypot(headX - tailX, headY - tailY) > 0.5
    ? holdAxisRotation(headX, headY, tailX, tailY)
    : fallbackRotation;
}

/** Convert a skew angle in degrees into the horizontal shear used by both renderers. */
export function noteSkewShear(skewDegrees: number): number {
  return Math.tan((skewDegrees * Math.PI) / 180);
}

/**
 * The line's skew sampler, or null when the control cannot tilt a note.
 *
 * Matches the preview runtime: one control point is the neutral value and does
 * not enable skew, while two or more points interpolate by floor distance.
 */
export function noteSkewCurve(
  line: Pick<JudgeLine, "skewControl"> | null | undefined,
): ControlCurve | null {
  const points = line?.skewControl;
  return points && points.length > 1 ? new ControlCurve(points, "skew") : null;
}

/**
 * Skew angle for a note in the static timeline.
 *
 * The timeline cannot sample the moving preview distance, so it uses the
 * distance where the note meets the line: `yOffset`. Holds never shear, which
 * keeps them aligned with the preview runtime.
 */
export function noteSkewAtHit(
  curve: ControlCurve | null,
  note: Pick<JudgeLineNote, "type" | "positionX" | "yOffset">,
): number {
  if (!curve || note.type === 2) {
    return 0;
  }
  return (note.positionX ?? 0) * curve.value(note.yOffset ?? 0);
}
