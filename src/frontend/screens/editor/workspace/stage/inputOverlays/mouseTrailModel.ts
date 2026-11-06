/**
 * The mouse trail's sample model: bounded ages, widths, and tail-first pruning.
 * Rendering stays in `mouseTrailRendering`.
 */
/** Oldest sample count kept in the trail. */
export const MOUSE_TRAIL_MAX_POINTS = 18;
/** Maximum age of a sample before it is pruned. */
export const MOUSE_TRAIL_MAX_AGE_MS = 450;
/**
 * When the pointer stops, the tail starts disappearing after this short frame
 * gap, so the streak shrinks immediately rather than waiting for the age window.
 */
export const MOUSE_TRAIL_RELEASE_MS = 24;
export const MOUSE_TRAIL_TAIL_WIDTH = 1.5;
export const MOUSE_TRAIL_HEAD_WIDTH = 4;
export const MOUSE_TRAIL_TAIL_ALPHA = 0.12;
export const MOUSE_TRAIL_HEAD_ALPHA = 0.82;

/** A point in client coordinates. */
export interface MouseTrailPosition {
  readonly x: number;
  readonly y: number;
}

/** One sampled pointer position with its trail width and opacity. */
export interface MouseTrailSample {
  x: number;
  y: number;
  width: number;
  alpha: number;
}

/** One ribbon segment between two adjacent samples. */
export interface MouseTrailSegment {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
  readonly width: number;
  readonly alpha: number;
}

/** The bounded render snapshot the overlay draws: head, samples, and segments. */
export interface MouseTrailFrame {
  readonly head: MouseTrailPosition | null;
  readonly samples: readonly MouseTrailSample[];
  readonly segments: readonly MouseTrailSegment[];
}

/** One pointer sample plus the timestamp used for ageing. */
interface MouseTrailPoint extends MouseTrailPosition {
  readonly sampledAt: number;
}

const EMPTY_FRAME: MouseTrailFrame = {
  head: null,
  samples: [],
  segments: [],
};

/** Whether both coordinates are finite numbers. */
function finitePosition(position: MouseTrailPosition): boolean {
  return Number.isFinite(position.x) && Number.isFinite(position.y);
}

/** Linear interpolation between `start` and `end`. */
function lerp(start: number, end: number, amount: number): number {
  return start + (end - start) * amount;
}

/**
 * Owns the mouse trail's complete lifecycle. Pointer events append samples;
 * the caller only advances the bounded render snapshot at the stable overlay
 * cadence. Rendering never adds samples, so repeated rAF callbacks cannot
 * create duplicate points or adjacent caps.
 */
export class MouseTrailRuntime {
  private readonly points: MouseTrailPoint[] = [];
  private readonly renderSamples: MouseTrailSample[] = [];
  private readonly renderSegments: MouseTrailSegment[] = [];
  private lastMoveAt = Number.NEGATIVE_INFINITY;

  /** Number of live samples; zero means the trail has fully faded. */
  get pointCount(): number {
    return this.points.length;
  }

  /** Appends a pointer sample, ignoring duplicates and non-finite input. */
  move(position: MouseTrailPosition, sampledAt: number): void {
    if (!finitePosition(position) || !Number.isFinite(sampledAt)) {
      return;
    }
    const latest = this.points[this.points.length - 1];
    if (latest?.x === position.x && latest.y === position.y) {
      return;
    }
    this.lastMoveAt = sampledAt;
    this.points.push({ x: position.x, y: position.y, sampledAt });
    if (this.points.length > MOUSE_TRAIL_MAX_POINTS) {
      this.points.shift();
    }
  }

  /** Drops every sample and resets the idle clock. */
  clear(): void {
    this.points.length = 0;
    this.renderSamples.length = 0;
    this.renderSegments.length = 0;
    this.lastMoveAt = Number.NEGATIVE_INFINITY;
  }

  /** Prunes aged samples and returns the bounded render snapshot for `now`. */
  advance(now: number): MouseTrailFrame {
    if (!Number.isFinite(now)) {
      return EMPTY_FRAME;
    }

    // While moving, only samples past the age window are dropped. Once the
    // pointer stops, the oldest point leaves on every frame so the streak
    // visibly contracts from its tail immediately; the head is the last point.
    const idle = now - this.lastMoveAt;
    if (idle > MOUSE_TRAIL_RELEASE_MS && this.points.length > 0) {
      this.points.shift();
    }
    while (this.points.length > 0 && now - this.points[0].sampledAt > MOUSE_TRAIL_MAX_AGE_MS) {
      this.points.shift();
    }
    if (this.points.length === 0) {
      this.renderSamples.length = 0;
      this.renderSegments.length = 0;
      return EMPTY_FRAME;
    }

    const head = this.points[this.points.length - 1];
    this.renderSamples.length = this.points.length;
    for (let index = 0; index < this.points.length; index += 1) {
      const progress = this.points.length === 1 ? 1 : index / (this.points.length - 1);
      const sample = this.renderSamples[index];
      const width = lerp(MOUSE_TRAIL_TAIL_WIDTH, MOUSE_TRAIL_HEAD_WIDTH, progress);
      const alpha = lerp(MOUSE_TRAIL_TAIL_ALPHA, MOUSE_TRAIL_HEAD_ALPHA, progress);
      if (sample) {
        sample.x = this.points[index].x;
        sample.y = this.points[index].y;
        sample.width = width;
        sample.alpha = alpha;
      } else {
        this.renderSamples[index] = {
          x: this.points[index].x,
          y: this.points[index].y,
          width,
          alpha,
        };
      }
    }

    const segmentCount = Math.max(0, this.renderSamples.length - 1);
    this.renderSegments.length = segmentCount;
    for (let index = 0; index < segmentCount; index += 1) {
      const start = this.renderSamples[index];
      const end = this.renderSamples[index + 1];
      this.renderSegments[index] = {
        x1: start.x,
        y1: start.y,
        x2: end.x,
        y2: end.y,
        width: end.width,
        alpha: end.alpha,
      };
    }

    return {
      head: { x: head.x, y: head.y },
      samples: this.renderSamples,
      segments: this.renderSegments,
    };
  }
}
