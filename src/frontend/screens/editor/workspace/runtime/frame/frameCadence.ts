/** Time-based gate for work driven by a display animation callback. */
export class FrameCadence {
  private rate = Number.NaN;
  private nextAt = Number.NaN;

  /** True when the requested rate permits work at this timestamp; updates the next slot. */
  allow(timestamp: number, requestedRate: number): boolean {
    if (!Number.isFinite(timestamp)) {
      return false;
    }
    const rate = normalizeRate(requestedRate);
    if (rate !== this.rate) {
      this.rate = rate;
      this.nextAt = timestamp;
    }
    const interval = 1000 / rate;
    const epsilon = Math.min(1, interval * 0.1);
    if (timestamp + epsilon < this.nextAt) {
      return false;
    }
    this.nextAt += interval * Math.max(1, Math.floor((timestamp - this.nextAt) / interval) + 1);
    return true;
  }

  /** Forgets the current rate so the next call re-seeds the schedule. */
  reset(): void {
    this.rate = Number.NaN;
    this.nextAt = Number.NaN;
  }
}

/** Clamps a requested rate to 1–144 Hz, defaulting to 144 for invalid input. */
export function normalizeRate(requestedRate: number): number {
  if (!Number.isFinite(requestedRate) || requestedRate === 0) {
    return 144;
  }
  return Math.min(144, Math.max(1, requestedRate));
}
