/**
 * Identity for a translated timeline layer that is anchored at one chart time.
 *
 * The layer is reused while playback advances and is blitted with a pixel
 * offset. The identity changes once per viewport span of chart time so a
 * translated layer stays anchored near its source bitmap; smaller playback
 * steps share a bucket and keep the cache.
 */
/** Cache identity for a translated layer at a chart-time origin. */
export function originRebaseKey(originSeconds: number, spanSeconds: number): string {
  const span = Math.max(0.25, Number(spanSeconds) || 0.25);
  const seconds = Number.isFinite(originSeconds) ? originSeconds : 0;
  return `translated-origin:${Math.floor(seconds / span)}`;
}

/** The chart-time span covered by one viewport height at the given pixel scale. */
export function viewportSpanSeconds(height: number, scale: number): number {
  return Math.max(0.25, Math.max(0, height) / Math.max(1, scale));
}
