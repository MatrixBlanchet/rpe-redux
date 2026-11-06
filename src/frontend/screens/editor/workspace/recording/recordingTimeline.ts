/** Fixed-rate recording times in the song and chart clocks. */

/** The half-open song interval, output speed, and the chart's offset in milliseconds. */
export interface RecordingTimelineOptions {
  readonly start: number;
  readonly end: number;
  readonly fps: number;
  readonly chartOffsetMs: number;
  /** Song seconds advanced per output frame; defaults to 1. */
  readonly speed?: number;
}

/** A frame's index and timestamps; audio and chart clocks differ by the chart offset. */
export interface RecordingFrameTime {
  readonly index: number;
  readonly songSeconds: number;
  readonly chartSeconds: number;
  readonly timestampUs: number;
}

/**
 * Validated frame schedule. Frame zero is the first instant in the selected song
 * interval; the last frame starts strictly before its end. Timestamps derive from
 * the index, rather than accumulating a rounded per-frame duration. A speed above
 * one advances the song faster while the output frame rate stays fixed, so the
 * output duration is the source interval divided by the speed.
 */
export class RecordingTimeline {
  readonly frameCount: number;
  readonly options: RecordingTimelineOptions & { readonly speed: number };

  /** Validates the interval, speed, and derives the exact frame count. */
  constructor(options: RecordingTimelineOptions) {
    const { start, end, fps, chartOffsetMs } = options;
    const speed = options.speed ?? 1;
    if (
      !Number.isFinite(start) ||
      !Number.isFinite(end) ||
      start < 0 ||
      end <= start ||
      !Number.isInteger(fps) ||
      fps < 1 ||
      fps > 240 ||
      !Number.isFinite(chartOffsetMs) ||
      !Number.isFinite(speed) ||
      speed < 0.5 ||
      speed > 4
    ) {
      throw new RangeError("Invalid recording timeline");
    }
    this.options = { ...options, speed };
    const count = ((end - start) * fps) / speed;
    const nearest = Math.round(count);
    // Decimal input may land a few ulps above an exact frame boundary.
    const tolerance =
      Number.EPSILON *
      8 *
      Math.max(1, Math.abs((start * fps) / speed), Math.abs((end * fps) / speed));
    this.frameCount =
      nearest > 0 && Math.abs(count - nearest) <= tolerance ? nearest : Math.ceil(count);
    if (!Number.isSafeInteger(this.frameCount) || this.frameCount < 1) {
      throw new RangeError("Invalid recording frame count");
    }
  }

  /** Resolve one frame without reading a real-time clock. */
  frame(index: number): RecordingFrameTime {
    if (!Number.isInteger(index) || index < 0 || index >= this.frameCount) {
      throw new RangeError("Recording frame is outside the interval");
    }
    const elapsed = (index / this.options.fps) * this.options.speed;
    const songSeconds = this.options.start + elapsed;
    return {
      index,
      songSeconds,
      chartSeconds: songSeconds - this.options.chartOffsetMs / 1000,
      timestampUs: Math.round((index * 1_000_000) / this.options.fps),
    };
  }
}
