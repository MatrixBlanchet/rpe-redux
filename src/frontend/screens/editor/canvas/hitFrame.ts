/** Shared hit-animation clock used by preview drawing and note-skin rendering. */

/** How long one hit-animation frame lasts, in seconds. */
export const HIT_FRAME_SECONDS = 0.015;
/** How many frames a hit animation runs for. */
export const HIT_FRAME_COUNT = 32;
/** Total duration of a hit animation, in seconds. */
export const HIT_DURATION = HIT_FRAME_SECONDS * HIT_FRAME_COUNT;

/**
 * Which animation frame an effect of the given age is on, 1-based.
 *
 * `null` means "no effect is playing": the age is negative (the hit has not
 * happened yet) or the animation has already finished.
 */
export function hitFrame(age: number, frameCount = HIT_FRAME_COUNT): number | null {
  const count = Math.max(0, Math.floor(frameCount));
  return age < 0 || count === 0 || age >= HIT_FRAME_SECONDS * count
    ? null
    : Math.floor(age / HIT_FRAME_SECONDS) + 1;
}
