/**
 * The preview's logical box.
 *
 * The stage paints a fixed logical coordinate space — the same one the chart's
 * judge lines are authored in — scaled to fit whatever the canvas measured. This
 * module maps the host size onto that box and reports where the box landed, so
 * every other preview calculation can work in chart units and be told the scale
 * once.
 *
 * The authoring box and the presentation frame are different shapes. The complete
 * 1350×900 box is mapped onto the displayed rectangle independently on each
 * axis, so a 4:3 frame stretches Y and a 16:9 frame stretches X. Nothing outside
 * the box is visible and no margin is left inside the frame. `scaleX`/`scaleY`
 * are the authoritative mapping; `scale` is the smaller one and is used only for
 * parts that must keep their aspect (note sprites, line thickness, text).
 */
import { PREVIEW_LOGICAL_SIZE } from "./constants.ts";

/** A preview viewport scaled to fit and centered in its host. */
export interface PreviewViewport {
  scale: number;
  scaleX: number;
  scaleY: number;
  width: number;
  height: number;
  left: number;
  top: number;
}

/** The painted rectangle of a viewport, without its logical-unit scale. */
export type PreviewViewportBounds = Pick<PreviewViewport, "left" | "top" | "width" | "height">;

/** The game's default presentation ratio when a chart does not specify one. */
export const DEFAULT_PREVIEW_ASPECT_RATIO = 4 / 3;

/** Parses `"16:9"` or a numeric ratio, falling back to the default on invalid input. */
export function previewAspectRatio(value: string | number | undefined): number {
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? value : DEFAULT_PREVIEW_ASPECT_RATIO;
  }
  const [rawWidth, rawHeight] = (value ?? "").split(":").map(Number);
  return Number.isFinite(rawWidth) && Number.isFinite(rawHeight) && rawWidth > 0 && rawHeight > 0
    ? rawWidth / rawHeight
    : DEFAULT_PREVIEW_ASPECT_RATIO;
}

/** Projects the canonical viewport into the rectangle-only shape used by culling. */
export function previewViewportBounds(viewport: PreviewViewport): PreviewViewportBounds {
  const { left, top, width, height } = viewport;
  return { left, top, width, height };
}

/**
 * Fits the chart's presentation frame into the host and maps the 1350×900
 * authoring box onto it.
 *
 * `scaleX` and `scaleY` are the independent axis mappings; `scale` is the
 * smaller of the two and suits aspect-preserving sprites and strokes.
 */
export function previewViewport(
  width: number,
  height: number,
  ratio = DEFAULT_PREVIEW_ASPECT_RATIO,
): PreviewViewport {
  const safeWidth = Math.max(0, Number(width) || 0);
  const safeHeight = Math.max(0, Number(height) || 0);
  const normalizedRatio = previewAspectRatio(ratio);
  // The ratio describes the game's presentation frame, not a smaller logical
  // chart window. Contain that frame in the host, then map the complete
  // 1350×900 authoring box onto it. Both axes fill the frame, so no letterbox
  // remains inside the frame and nothing outside the authoring box is painted.
  const frameWidth = Math.min(safeWidth, safeHeight * normalizedRatio);
  const frameHeight = Math.min(safeHeight, safeWidth / normalizedRatio);
  const scaleX = frameWidth / PREVIEW_LOGICAL_SIZE.width;
  const scaleY = frameHeight / PREVIEW_LOGICAL_SIZE.height;
  return {
    scale: Math.min(scaleX, scaleY),
    scaleX,
    scaleY,
    width: frameWidth,
    height: frameHeight,
    left: (safeWidth - frameWidth) / 2,
    top: (safeHeight - frameHeight) / 2,
  };
}
