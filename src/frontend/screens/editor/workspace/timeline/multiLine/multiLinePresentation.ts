// Presentation rules shared by multi-line drawing: opacity for non-current lines
// and zoom scaling for the active note or event area.
//
// These are pure calculations and read no session or DOM state.

/** Opacity applied to every multi-line panel except the active line. */
export const DEFAULT_MULTI_LINE_NON_CURRENT_OPACITY = 180 / 255;

/** Full opacity for the current line, configured opacity for every other line. */
export function multiLineLineOpacity(
  lineIndex: number,
  currentLineIndex: number,
  nonCurrentOpacity = DEFAULT_MULTI_LINE_NON_CURRENT_OPACITY,
): number {
  if (lineIndex === currentLineIndex) {
    return 1;
  }
  return Math.max(0, Math.min(1, Number(nonCurrentOpacity) || 0));
}

/** Apply the multi-line zoom only to the active area. */
export function multiLineScale(baseScale: number, zoom: number, active: boolean): number {
  return active ? baseScale * Math.max(0.35, Math.min(6, Number(zoom) || 1)) : baseScale;
}
