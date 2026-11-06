/**
 * Opt-in frame timing for the preview: bounded samples, percentiles and the
 * pass/fail verdicts used by performance diagnostics.
 *
 * Recording is disabled by default and overwrites a fixed ring buffer, so
 * enabling it costs no allocation or sorting in the normal render loop.
 */
export interface FrameMeasurement {
  readonly timestamp: number;
  readonly drawMs: number;
  readonly chartSeconds: number;
}

interface PlaybackMetricPercentiles {
  readonly p50: number | null;
  readonly p95: number | null;
  readonly p99: number | null;
  readonly max: number | null;
}

export interface PlaybackMetricsReport {
  readonly enabled: boolean;
  readonly frames: number;
  readonly totalFrames: number;
  readonly truncated: boolean;
  readonly elapsedMs: number;
  readonly fps: number | null;
  readonly minWindowFps: number | null;
  readonly drawMs: PlaybackMetricPercentiles;
  readonly intervalMs: PlaybackMetricPercentiles;
  readonly over60Budget: number;
  readonly over144Budget: number;
  readonly stalls50ms: number;
  readonly minimum60: "insufficient-data" | "pass" | "fail";
  readonly target144: "insufficient-data" | "pass" | "fail";
  readonly raw: readonly FrameMeasurement[];
}

/** Nearest-rank percentile of an ascending list; null when empty. */
const percentile = (values: readonly number[], fraction: number) =>
  values.length ? values[Math.max(0, Math.ceil(values.length * fraction) - 1)] : null;

/** Opt-in bounded measurements; no sorting/allocation in the normal render loop. */
export class PlaybackMetrics {
  enabled = false;
  private frames: FrameMeasurement[] = [];
  private cursor = 0;
  private total = 0;
  readonly capacity: number;

  /** Allocates room for `capacity` frames; requires at least two. */
  constructor(capacity = 20000) {
    if (!Number.isInteger(capacity) || capacity < 2) {
      throw new RangeError("capacity must be >= 2");
    }
    this.capacity = capacity;
  }
  /** Clears stored frames and begins recording. */
  start(): void {
    this.frames = [];
    this.cursor = 0;
    this.total = 0;
    this.enabled = true;
  }
  /** Stops recording and returns the report for the captured frames. */
  stop(): PlaybackMetricsReport {
    this.enabled = false;
    return this.report();
  }
  /** Stores one frame in the ring buffer; rejects non-finite measurements. */
  record(timestamp: number, drawMs: number, chartSeconds: number): void {
    if (!this.enabled) {
      return;
    }
    if (![timestamp, drawMs, chartSeconds].every(Number.isFinite) || drawMs < 0) {
      throw new RangeError("Invalid frame measurement");
    }
    this.frames[this.cursor] = { timestamp, drawMs, chartSeconds };
    this.cursor = (this.cursor + 1) % this.capacity;
    this.total++;
  }
  /** Builds percentiles, frame-rate windows, and budget verdicts from stored frames. */
  report(): PlaybackMetricsReport {
    const orderedFrames =
      this.total > this.capacity
        ? [...this.frames.slice(this.cursor), ...this.frames.slice(0, this.cursor)]
        : [...this.frames];
    const frames = orderedFrames.map(({ timestamp, drawMs, chartSeconds }) => ({
      timestamp,
      drawMs,
      chartSeconds,
    }));
    const intervals = frames
      .slice(1)
      .map((frame, index) => frame.timestamp - frames[index].timestamp);
    const lastFrame = frames.at(-1);
    const elapsedMs = lastFrame ? lastFrame.timestamp - frames[0].timestamp : 0;
    const draw = frames.map((frame) => frame.drawMs).sort((a, b) => a - b);
    const sortedIntervals = [...intervals].sort((a, b) => a - b);
    const windows: number[] = [];
    let start = 0;
    for (let end = 1; end < frames.length; end++) {
      while (frames[end].timestamp - frames[start + 1].timestamp >= 1000) {
        start++;
      }
      const duration = frames[end].timestamp - frames[start].timestamp;
      if (duration >= 1000) {
        windows.push(((end - start) * 1000) / duration);
      }
    }
    const fps = elapsedMs > 0 ? (intervals.length * 1000) / elapsedMs : null;
    const minWindowFps = windows.length ? Math.min(...windows) : null;
    const raw = Object.freeze(frames.map((frame) => Object.freeze({ ...frame })));
    return Object.freeze({
      enabled: this.enabled,
      frames: frames.length,
      totalFrames: this.total,
      truncated: this.total > this.capacity,
      elapsedMs,
      fps,
      minWindowFps,
      drawMs: {
        p50: percentile(draw, 0.5),
        p95: percentile(draw, 0.95),
        p99: percentile(draw, 0.99),
        max: draw.at(-1) ?? null,
      },
      intervalMs: {
        p50: percentile(sortedIntervals, 0.5),
        p95: percentile(sortedIntervals, 0.95),
        p99: percentile(sortedIntervals, 0.99),
        max: sortedIntervals.at(-1) ?? null,
      },
      over60Budget: intervals.filter((ms) => ms > 1000 / 60 + 0.1).length,
      over144Budget: intervals.filter((ms) => ms > 1000 / 144 + 0.1).length,
      stalls50ms: intervals.filter((ms) => ms > 50).length,
      minimum60:
        minWindowFps === null ? "insufficient-data" : minWindowFps >= 59.5 ? "pass" : "fail",
      target144:
        minWindowFps === null ? "insufficient-data" : minWindowFps >= 143.5 ? "pass" : "fail",
      raw,
    });
  }
}
