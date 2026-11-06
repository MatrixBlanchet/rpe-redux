/**
 * Token-bucket budget for sandbox `ui.update` traffic.
 *
 * One budget belongs to one Extension sandbox, so its owner is fixed. Every
 * surface gets separate ordinary and `replace` buckets: each allows a 30 Hz
 * steady rate with a two-frame burst. Updates over budget are dropped from the
 * current frame, but the newest dropped tree stays pending and is delivered
 * when its bucket refills. A burst therefore always ends on the last declared
 * tree, and releasing a surface or the sandbox cancels its pending timer.
 */

/** Steady-state updates per second allowed for each surface bucket. */
export const UI_UPDATE_STEADY_HZ = 30;

/** Updates a bucket may deliver back-to-back before the steady rate applies. */
export const UI_UPDATE_BURST = 2;

/** Injectable clock used by the budget; tests supply a deterministic one. */
export interface SandboxUiBudgetClock {
  /** Current time in milliseconds; only differences between calls matter. */
  now(): number;
  /** Schedule one refill tick; the handle is opaque to the budget. */
  setTimeout(handler: () => void, delayMs: number): unknown;
  /** Cancel a handle returned by the matching `setTimeout`. */
  clearTimeout(handle: unknown): void;
}

/** One candidate tree and whether it carries replace semantics. */
export interface SandboxUiUpdate<T> {
  /** Sanitized tree the surface should render. */
  readonly tree: T;
  /** Whether this update remounts the rendered tree. */
  readonly replace: boolean;
}

/** Result of offering one update to the budget. */
export interface SandboxUiUpdateAdmission {
  /** Whether the update reached the surface immediately. */
  readonly delivered: boolean;
  /** Whether the update waits for a later refill instead of rendering now. */
  readonly dropped: boolean;
  /** Ordinary and replace updates dropped for this surface so far. */
  readonly surfaceDropped: number;
}

/** Aggregate counters for one sandbox budget. */
export interface SandboxUiBudgetStats {
  /** Updates delivered immediately or as a pending tail. */
  readonly delivered: number;
  /** Updates that missed their frame; the latest one may still be pending. */
  readonly dropped: number;
  /** Surfaces that still own a bucket or a pending update. */
  readonly surfaces: number;
}

/** Construction options for one budget; tests shrink the clock only. */
export interface SandboxUiBudgetOptions {
  /** Clock and timer surface; defaults to the host's wall clock and timers. */
  readonly clock?: SandboxUiBudgetClock;
}

/** Available tokens and the last time they were refilled. */
interface Bucket {
  tokens: number;
  lastRefill: number;
}

/** Floating-point slack when a refill lands exactly on a whole token. */
const TOKEN_EPSILON = 1e-9;

/** One pending update and the delivery callback supplied with it. */
interface PendingUpdate<T> {
  readonly update: SandboxUiUpdate<T>;
  readonly deliver: (update: SandboxUiUpdate<T>) => void;
}

/** Buckets and pending work for one surface. */
interface SurfaceBudget<T> {
  readonly normal: Bucket;
  readonly replace: Bucket;
  pending: PendingUpdate<T> | null;
  timer: unknown | null;
  timerDue: number;
  dropped: number;
}

/** The host clock and timers used when a caller supplies no clock. */
const defaultClock: SandboxUiBudgetClock = {
  now: () => Date.now(),
  setTimeout: (handler, delayMs) => globalThis.setTimeout(handler, delayMs),
  clearTimeout: (handle) =>
    globalThis.clearTimeout(handle as ReturnType<typeof globalThis.setTimeout>),
};

/**
 * Per-surface token buckets shared by one Extension sandbox.
 *
 * `submit` never throws for excess traffic: it drops the frame, keeps the
 * latest tree pending, and reports the drop so the caller can log it. The
 * timer only exists while a pending update waits for a token.
 */
export class SandboxUiUpdateBudget<T> {
  private readonly owner: string;
  private readonly clock: SandboxUiBudgetClock;
  private readonly intervalMs: number;
  private readonly capacity: number;
  private readonly surfaces = new Map<string, SurfaceBudget<T>>();
  private delivered = 0;
  private dropped = 0;

  /**
   * Create the budget for one owner.
   *
   * `owner` is used by logs and diagnostics; the caller keeps one budget per
   * sandbox, so surface ids only need to be unique inside that sandbox.
   */
  constructor(owner: string, options: SandboxUiBudgetOptions = {}) {
    this.owner = owner;
    this.clock = options.clock ?? defaultClock;
    this.intervalMs = 1000 / UI_UPDATE_STEADY_HZ;
    this.capacity = UI_UPDATE_BURST;
  }

  /** The Extension whose sandbox owns this budget. */
  get extensionId(): string {
    return this.owner;
  }

  /**
   * Offer one already-sanitized tree to a surface.
   *
   * A bucket with a token delivers immediately and supersedes any older
   * pending tree. A bucket without one records the drop and keeps this update
   * as the pending tail; `deliver` runs when the bucket refills.
   */
  submit(
    surfaceId: string,
    update: SandboxUiUpdate<T>,
    deliver: (update: SandboxUiUpdate<T>) => void,
  ): SandboxUiUpdateAdmission {
    const now = this.clock.now();
    const surface = this.surfaceFor(surfaceId);
    const bucket = update.replace ? surface.replace : surface.normal;
    this.refill(bucket, now);
    if (bucket.tokens >= 1 - TOKEN_EPSILON) {
      bucket.tokens = Math.max(0, bucket.tokens - 1);
      this.clearPending(surface);
      this.delivered += 1;
      deliver(update);
      return { delivered: true, dropped: false, surfaceDropped: surface.dropped };
    }
    surface.dropped += 1;
    this.dropped += 1;
    surface.pending = { update, deliver };
    this.schedule(surfaceId, surface, now);
    return { delivered: false, dropped: true, surfaceDropped: surface.dropped };
  }

  /** Release one surface and cancel its pending timer; returns whether it existed. */
  release(surfaceId: string): boolean {
    const surface = this.surfaces.get(surfaceId);
    if (!surface) {
      return false;
    }
    this.cancelTimer(surface);
    this.surfaces.delete(surfaceId);
    return true;
  }

  /** Release every surface, which is what sandbox disposal does. */
  dispose(): void {
    for (const surface of this.surfaces.values()) {
      this.cancelTimer(surface);
    }
    this.surfaces.clear();
  }

  /** Read the budget's observable counters. */
  stats(): SandboxUiBudgetStats {
    return Object.freeze({
      delivered: this.delivered,
      dropped: this.dropped,
      surfaces: this.surfaces.size,
    });
  }

  /** Return the surface state, creating empty buckets on first use. */
  private surfaceFor(surfaceId: string): SurfaceBudget<T> {
    const existing = this.surfaces.get(surfaceId);
    if (existing) {
      return existing;
    }
    const now = this.clock.now();
    const surface: SurfaceBudget<T> = {
      normal: { tokens: this.capacity, lastRefill: now },
      replace: { tokens: this.capacity, lastRefill: now },
      pending: null,
      timer: null,
      timerDue: 0,
      dropped: 0,
    };
    this.surfaces.set(surfaceId, surface);
    return surface;
  }

  /** Add the tokens earned since the last refill, capped at the burst size. */
  private refill(bucket: Bucket, now: number): void {
    const elapsed = now - bucket.lastRefill;
    if (elapsed <= 0) {
      return;
    }
    bucket.tokens = Math.min(this.capacity, bucket.tokens + elapsed / this.intervalMs);
    bucket.lastRefill = now;
  }

  /** Milliseconds until one token is available for this bucket. */
  private waitForToken(bucket: Bucket): number {
    return Math.max(0, (1 - bucket.tokens) * this.intervalMs);
  }

  /** Arm the earliest timer that can deliver the current pending update. */
  private schedule(surfaceId: string, surface: SurfaceBudget<T>, now: number): void {
    const pending = surface.pending;
    if (!pending) {
      return;
    }
    const bucket = pending.update.replace ? surface.replace : surface.normal;
    const due = now + this.waitForToken(bucket);
    if (surface.timer !== null) {
      if (due >= surface.timerDue) {
        return;
      }
      this.cancelTimer(surface);
    }
    surface.timerDue = due;
    surface.timer = this.clock.setTimeout(
      () => {
        if (this.surfaces.get(surfaceId) !== surface) {
          return;
        }
        this.flush(surfaceId, surface);
      },
      Math.max(0, due - now),
    );
  }

  /** Deliver the pending tail once its bucket has a token, or rearm the timer. */
  private flush(surfaceId: string, surface: SurfaceBudget<T>): void {
    surface.timer = null;
    surface.timerDue = 0;
    const pending = surface.pending;
    if (!pending) {
      return;
    }
    const now = this.clock.now();
    const bucket = pending.update.replace ? surface.replace : surface.normal;
    this.refill(bucket, now);
    if (bucket.tokens < 1 - TOKEN_EPSILON) {
      this.schedule(surfaceId, surface, now);
      return;
    }
    bucket.tokens = Math.max(0, bucket.tokens - 1);
    surface.pending = null;
    this.delivered += 1;
    pending.deliver(pending.update);
  }

  /** Cancel a pending tail and its timer after an immediate delivery. */
  private clearPending(surface: SurfaceBudget<T>): void {
    this.cancelTimer(surface);
    surface.pending = null;
  }

  /** Cancel the surface timer and reset its due time. */
  private cancelTimer(surface: SurfaceBudget<T>): void {
    if (surface.timer === null) {
      return;
    }
    this.clock.clearTimeout(surface.timer);
    surface.timer = null;
    surface.timerDue = 0;
  }
}
