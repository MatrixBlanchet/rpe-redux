/**
 * Noise-line size sampling shared by preview and export.
 *
 * A noise line's scale tracks are its size tracks: a missing track or a time
 * before the first event means zero size. The scene runtime normally falls back
 * to 1 because its scale tracks describe a texture multiplier; noise lines need
 * the explicit zero instead.
 */
export interface NoiseSizeTrack {
  readonly sources: readonly unknown[];
  readonly starts: ArrayLike<number>;
}

/** Size for `value` at `seconds`, or zero before the track's first event. */
export function noiseLineSizeAt(track: NoiseSizeTrack, value: number, seconds: number): number {
  return track.sources.length && seconds + 1e-9 >= track.starts[0] ? value : 0;
}
