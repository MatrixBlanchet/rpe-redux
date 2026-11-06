/**
 * Sampled event accumulators shared by the interchange exporters.
 *
 * Both official JSON and PEC are linear/constant formats. The exporters sample
 * the live RPE runtime on a fixed beat grid, then these tracks merge adjacent
 * samples when the slope is unchanged. That keeps a static line at one event
 * and only expands a segment where easing or parent motion actually bends it.
 */

/** One linear numeric segment in target-format time units. */
export interface NumericSegment {
  startTime: number;
  endTime: number;
  start: number;
  end: number;
}

/** One paired X/Y move segment in target-format time units. */
export interface MoveSegment {
  startTime: number;
  endTime: number;
  start: number;
  end: number;
  start2: number;
  end2: number;
}

/** One constant speed segment and its cumulative floor at the start. */
export interface SpeedSegment {
  startTime: number;
  endTime: number;
  value: number;
  floorPosition: number;
}

/** Collected samples on a linear numeric track. */
export class LinearTrack {
  private readonly segments: NumericSegment[] = [];
  private lastTime = Number.NaN;
  private lastValue = 0;

  /** Add one sample; the first sample only establishes the starting value. */
  push(time: number, value: number): void {
    if (!Number.isFinite(value)) {
      return;
    }
    if (!Number.isFinite(this.lastTime)) {
      this.lastTime = time;
      this.lastValue = value;
      return;
    }
    if (time <= this.lastTime) {
      return;
    }
    const previous = this.segments.at(-1);
    const slope = (value - this.lastValue) / (time - this.lastTime);
    const previousSlope = previous
      ? (previous.end - previous.start) / (previous.endTime - previous.startTime)
      : Number.NaN;
    if (
      previous &&
      Math.abs(previous.endTime - this.lastTime) < 1e-9 &&
      Math.abs(previousSlope - slope) < 1e-6
    ) {
      previous.endTime = time;
      previous.end = value;
    } else {
      this.segments.push({
        startTime: this.lastTime,
        endTime: time,
        start: this.lastValue,
        end: value,
      });
    }
    this.lastTime = time;
    this.lastValue = value;
  }

  /** The merged segments, with no zero-length entries. */
  result(): NumericSegment[] {
    return this.segments.filter((segment) => segment.endTime > segment.startTime);
  }
}

/** Collected paired X/Y samples on a move track. */
export class MoveTrack {
  private readonly segments: MoveSegment[] = [];
  private lastTime = Number.NaN;
  private lastX = 0;
  private lastY = 0;

  /** Add one paired sample; the first sample only establishes the origin. */
  push(time: number, x: number, y: number): void {
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return;
    }
    if (!Number.isFinite(this.lastTime)) {
      this.lastTime = time;
      this.lastX = x;
      this.lastY = y;
      return;
    }
    if (time <= this.lastTime) {
      return;
    }
    const previous = this.segments.at(-1);
    const slopeX = (x - this.lastX) / (time - this.lastTime);
    const slopeY = (y - this.lastY) / (time - this.lastTime);
    const previousSlopeX = previous
      ? (previous.end - previous.start) / (previous.endTime - previous.startTime)
      : Number.NaN;
    const previousSlopeY = previous
      ? (previous.end2 - previous.start2) / (previous.endTime - previous.startTime)
      : Number.NaN;
    if (
      previous &&
      Math.abs(previous.endTime - this.lastTime) < 1e-9 &&
      Math.abs(previousSlopeX - slopeX) < 1e-6 &&
      Math.abs(previousSlopeY - slopeY) < 1e-6
    ) {
      previous.endTime = time;
      previous.end = x;
      previous.end2 = y;
    } else {
      this.segments.push({
        startTime: this.lastTime,
        endTime: time,
        start: this.lastX,
        end: x,
        start2: this.lastY,
        end2: y,
      });
    }
    this.lastTime = time;
    this.lastX = x;
    this.lastY = y;
  }

  /** The merged segments, with no zero-length entries. */
  result(): MoveSegment[] {
    return this.segments.filter((segment) => segment.endTime > segment.startTime);
  }
}

/** Collected constant-speed samples and their cumulative floor. */
export class SpeedTrack {
  private readonly segments: SpeedSegment[] = [];

  /** Add or extend one constant-speed interval. */
  push(startTime: number, endTime: number, value: number, floorPosition: number): void {
    if (endTime <= startTime) {
      return;
    }
    const previous = this.segments.at(-1);
    if (
      previous &&
      Math.abs(previous.endTime - startTime) < 1e-9 &&
      Math.abs(previous.value - value) < 1e-6
    ) {
      previous.endTime = endTime;
      return;
    }
    this.segments.push({ startTime, endTime, value, floorPosition });
  }

  /** The accumulated intervals. */
  result(): SpeedSegment[] {
    return this.segments;
  }
}
