/** Audio-thread gain transitions that keep running when the window is hidden. */

/** Smoothly moves a gain from its current value to the requested level. */
export function rampGain(param: AudioParam, now: number, value: number, seconds = 0.36): void {
  if (typeof param.cancelAndHoldAtTime === "function") {
    param.cancelAndHoldAtTime(now);
  } else {
    const current = param.value;
    param.cancelScheduledValues(now);
    param.setValueAtTime(current, now);
  }
  param.linearRampToValueAtTime(value, now + seconds);
}
