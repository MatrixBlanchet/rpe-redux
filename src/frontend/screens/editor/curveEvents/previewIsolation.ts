/**
 * Applies the curve trajectory preview's render filter to the live preview.
 *
 * The filter is two fields on the preview renderer, but assigning them from React
 * is not a data mutation: they are draw options that must be set and cleared
 * around a mode. Keeping them in one function gives that ownership a home.
 */
import type { Preview } from "../workspace/preview/scene/preview.ts";

/** Highlight colour for the edited judge line. */
const CURVE_FOCUS_COLOR = [255, 64, 64] as const;

/** Renderer line filters for one curve session. */
export interface CurvePreviewLineTargets {
  soloLine: number | null;
  focusLine: number | null;
}

/** Resolve the solo/focus filters from the current line and the two toggles. */
export function curvePreviewLineTargets(options: {
  active: boolean;
  previewLineOnly: boolean;
  lineIndex: number;
}): CurvePreviewLineTargets {
  return {
    soloLine: options.active && options.previewLineOnly ? options.lineIndex : null,
    focusLine: options.active ? options.lineIndex : null,
  };
}

/**
 * Show only `soloLine` and the notes attached to it, and paint `focusLine` red.
 *
 * `null` restores the whole chart. Frame invalidation makes the change visible
 * before the next playback frame.
 */
export function applyCurvePreviewLine(
  preview: Preview,
  options: { soloLine: number | null; focusLine: number | null },
): void {
  preview.soloLine = options.soloLine;
  preview.focusLine = options.focusLine;
  if (options.focusLine !== null) {
    preview.focusLineColor = CURVE_FOCUS_COLOR;
  }
  preview.invalidateFrame();
  preview.invalidate?.();
}
