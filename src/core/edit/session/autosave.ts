/** Scheduling is injected so the save policy does not depend on the browser. */
export type TimerHandle = ReturnType<typeof setTimeout> | number;

export interface AutoSaveScheduler {
  schedule(callback: () => void): TimerHandle;
  cancel(timer: TimerHandle): void;
}

const timerScheduler: AutoSaveScheduler = {
  schedule: (callback) => setTimeout(callback, 0),
  cancel: (timer) => clearTimeout(timer),
};

/** Throttles dirty saves and lets a reset invalidate saves already in flight. */
export class AutoSaveClock {
  private readonly scheduler: AutoSaveScheduler;
  save: () => unknown;
  reportError: (error: unknown) => void;
  last: number;
  pending: boolean;
  timer: TimerHandle | null;
  /** Bumped by `cancel()` to invalidate saves that are already in flight. */
  declare generation: number;
  resolvePending: (() => void) | null;

  /** Wires the save callback, error reporter, and scheduler. */
  constructor(
    save: () => unknown,
    reportError: (error: unknown) => void,
    scheduler: AutoSaveScheduler = timerScheduler,
  ) {
    this.scheduler = scheduler;
    this.save = save;
    this.reportError = reportError;
    this.last = 0;
    this.pending = false;
    this.timer = null;
    this.resolvePending = null;
  }
  /** Cancels the pending timer and invalidates any save already running. */
  cancel(): void {
    this.generation = (this.generation ?? 0) + 1;
    if (this.timer !== null) {
      this.scheduler.cancel(this.timer);
    }
    this.timer = null;
    this.pending = false;
    this.resolvePending?.();
    this.resolvePending = null;
  }
  /** Cancels pending work and restarts the interval from `now`. */
  reset(now: number): void {
    this.cancel();
    this.last = now;
  }
  /** Starts a save when due; resolves when it settles, or undefined when idle. */
  tick(now: number, enabled: boolean, seconds: number, dirty: boolean): Promise<void> | undefined {
    if (!enabled || !dirty || this.pending || now - this.last < seconds * 1000) {
      return undefined;
    }
    this.last = now;
    this.pending = true;
    let resolveSave: (() => void) | undefined;
    const generation = this.generation;
    const finished = new Promise<void>((resolve) => {
      resolveSave = () => resolve();
      this.resolvePending = () => resolve();
    });
    /** Runs the save unless a reset invalidated this generation. */
    const save = async () => {
      try {
        if (generation === this.generation) {
          await this.save();
        }
      } catch (error) {
        this.reportError(error);
      } finally {
        if (generation === this.generation) {
          this.pending = false;
          this.timer = null;
          this.resolvePending = null;
        }
        resolveSave?.();
      }
    };
    this.timer = this.scheduler.schedule(save);
    return finished;
  }
}
