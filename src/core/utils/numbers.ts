/**
 * Small numeric helpers shared across the chart, media and design layers.
 *
 * `clamp` constrains a value to an inclusive range and `clamp01` to the normalized
 * range used by alpha and spectrum data.
 */
/** Constrain a number to an inclusive range. */
export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

/** Constrain a number to the normalized range `[0, 1]`. */
export function clamp01(value: number): number {
  return clamp(value, 0, 1);
}
