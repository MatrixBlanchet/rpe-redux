/** True when a new animation frame may run; every display frame is allowed. */
export function lineSwitcherFrameDue(lastFrame: number, timestamp: number): boolean {
  return Number.isFinite(timestamp) && timestamp > lastFrame;
}
