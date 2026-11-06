/**
 * Progress-bar value math.
 *
 * Keeping the clamp separate from the React component lets the indeterminate
 * state, invalid bounds, and overflow rules be tested without a DOM.
 */

/** Completed fraction in `[0, 1]`, or `null` when the bar is indeterminate. */
export function progressRatio(value: number | undefined, max: number): number | null {
  if (value === undefined || !Number.isFinite(value) || !Number.isFinite(max) || max <= 0) {
    return null;
  }
  return Math.max(0, Math.min(1, value / max));
}
