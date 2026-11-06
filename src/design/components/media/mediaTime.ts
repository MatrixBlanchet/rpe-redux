/**
 * Time formatting shared by the audio and video players.
 *
 * A media transport shows offsets as `m:ss`; keeping the rule in one place means
 * both players round, clamp, and label time identically.
 */

/** Format a media offset as `m:ss`, reading non-finite or negative input as `0:00`. */
export function formatMediaTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "0:00";
  }
  const total = Math.floor(seconds);
  const minutes = Math.floor(total / 60);
  const remainder = total % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

/** A non-negative finite media offset, or `undefined` when the caller left it unset. */
export function mediaSeconds(value: number | undefined): number | undefined {
  return value !== undefined && Number.isFinite(value) ? Math.max(0, value) : undefined;
}
