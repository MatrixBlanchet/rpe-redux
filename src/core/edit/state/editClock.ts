/** Tracks active editing time, excluding time spent at home or in a hidden window. */
export class EditorEditClock {
  private elapsedSeconds = 0;
  private previousTick: number;

  /** Starts the clock at `now()` with no accumulated time. */
  constructor(now: () => number = () => performance.now()) {
    this.previousTick = now();
  }

  /** Accumulated active editing time in seconds. */
  get seconds(): number {
    return this.elapsedSeconds;
  }

  /** Discards accumulated time and restarts measurement at `now()`. */
  reset(now: () => number = () => performance.now()): void {
    this.elapsedSeconds = 0;
    this.previousTick = now();
  }

  /** Adds the interval since the previous tick when `active` is true. */
  advance(timestamp: number, active: boolean): void {
    const elapsed = Math.max(0, (timestamp - this.previousTick) / 1000);
    if (active) {
      this.elapsedSeconds += elapsed;
    }
    this.previousTick = timestamp;
  }

  /** Formats accumulated time as hours, minutes, and seconds. */
  format(): string {
    return `${String(Math.floor(this.seconds / 3600)).padStart(2, "0")} h, ${String(Math.floor(this.seconds / 60) % 60).padStart(2, "0")} m, ${String(Math.floor(this.seconds) % 60).padStart(2, "0")} s`;
  }
}
