/**
 * Smooth Alt+wheel vertical zoom for the timeline.
 *
 * Wheel events update a target scale; a short eased animation moves the viewport
 * toward it while keeping the beat under the pointer fixed. A new wheel during
 * the animation accumulates on the previous target, so consecutive notches feel
 * continuous.
 */
import type { TimelineViewport } from "../viewport/timelineViewport.ts";

const ZOOM_MIN = 20;
const ZOOM_MAX = 2000;
const ZOOM_DURATION_MS = 140;
const ZOOM_FACTOR_LIMIT = 300;
const ZOOM_SENSITIVITY = 0.0015;

/** A wheel delta as a multiplicative scale, bounded for coalesced events. */
export function timelineZoomFactor(deltaY: number): number {
  const bounded = Math.max(-ZOOM_FACTOR_LIMIT, Math.min(ZOOM_FACTOR_LIMIT, deltaY));
  return Math.exp(-bounded * ZOOM_SENSITIVITY);
}

/** Eases the viewport scale toward a wheel target while pinning the beat under the pointer. */
export class TimelineZoomAnimator {
  private frame = 0;
  private startedAt = 0;
  private fromScale = 0;
  private toScale = 0;
  private anchorSeconds = 0;
  private anchorOffset = 0;
  private anchorFactor = 1;
  private readonly viewport: TimelineViewport;
  private readonly invalidate: () => void;
  private readonly settled: () => void;

  /** Bind the animator to its viewport and redraw callbacks. */
  constructor(viewport: TimelineViewport, invalidate: () => void, settled: () => void) {
    this.viewport = viewport;
    this.invalidate = invalidate;
    this.settled = settled;
  }

  /** True while an animation frame is scheduled. */
  get active(): boolean {
    return this.frame !== 0;
  }

  /** Start or retarget a zoom toward `factor` around the pointer's vertical position. */
  request(factor: number, vertical: number): void {
    if (!Number.isFinite(factor) || factor <= 0) {
      return;
    }
    const current = this.viewport.scale;
    const target = Math.max(
      ZOOM_MIN,
      Math.min(ZOOM_MAX, (this.active ? this.toScale : current) * factor),
    );
    if (target === current && !this.active) {
      return;
    }
    const height = this.viewport.viewHeight();
    const offset = height - this.viewport.judgementOffset - vertical;
    const factorAtPointer = this.viewport.factor;
    if (!this.active || offset !== this.anchorOffset) {
      this.anchorSeconds =
        this.viewport.tempo.seconds(this.viewport.origin, factorAtPointer) + offset / current;
      this.anchorOffset = offset;
      this.anchorFactor = factorAtPointer;
    }
    this.fromScale = current;
    this.toScale = target;
    this.startedAt = performance.now();
    if (this.frame === 0) {
      this.frame = requestAnimationFrame(this.tick);
    }
  }

  /** Stop the running animation without settling the viewport. */
  cancel(): void {
    if (this.frame !== 0) {
      cancelAnimationFrame(this.frame);
      this.frame = 0;
    }
  }

  /** Advance one animation frame and settle when the duration elapses. */
  private readonly tick = (now: number): void => {
    this.frame = 0;
    const progress = Math.min(1, (now - this.startedAt) / ZOOM_DURATION_MS);
    // A cubic ease-out settles quickly but never snaps on the first frame.
    const eased = 1 - Math.pow(1 - progress, 3);
    const scale = this.fromScale + (this.toScale - this.fromScale) * eased;
    this.viewport.scale = scale;
    const minimum = this.viewport.tempo.beat(
      this.viewport.minimumScrollSeconds(),
      this.anchorFactor,
    );
    const origin = this.viewport.tempo.beat(
      this.anchorSeconds - this.anchorOffset / scale,
      this.anchorFactor,
    );
    this.viewport.origin = Math.max(origin, minimum);
    this.invalidate();
    if (progress < 1) {
      this.frame = requestAnimationFrame(this.tick);
      return;
    }
    this.settled();
  };
}
