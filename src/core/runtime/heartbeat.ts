/**
 * Liveness probing for a long-lived transport.
 *
 * A heartbeat sends a ping on a fixed interval and declares the transport dead
 * when no inbound message has arrived for `intervalMs + timeoutMs`. The caller
 * owns what a ping means and what happens after a timeout; this module only owns
 * the timing rule, which keeps WebSocket, IPC, and HTTP polling on one policy.
 */

/** Injectable timer surface so tests do not wait for real intervals. */
export interface HeartbeatTimers {
  now(): number;
  setInterval(callback: () => void, delayMs: number): unknown;
  clearInterval(handle: unknown): void;
}

/** Default host timers. */
export const systemHeartbeatTimers: HeartbeatTimers = Object.freeze({
  now: () => Date.now(),
  setInterval: (callback: () => void, delayMs: number) => setInterval(callback, delayMs),
  clearInterval: (handle: unknown) => clearInterval(handle as ReturnType<typeof setInterval>),
});

/** Timing and callbacks for one heartbeat. */
export interface HeartbeatOptions {
  /** How often a ping is sent while the transport is quiet. */
  readonly intervalMs: number;
  /** Extra time allowed after a ping before the transport is considered dead. */
  readonly timeoutMs: number;
  onPing(): void;
  onTimeout(): void;
  readonly timers?: HeartbeatTimers;
}

/** One liveness probe; start, stop, and touch it as transport events arrive. */
export class Heartbeat {
  private readonly options: HeartbeatOptions;
  private readonly timers: HeartbeatTimers;
  private handle: unknown = null;
  private lastSeen = 0;

  /** Create a stopped heartbeat. */
  constructor(options: HeartbeatOptions) {
    this.options = options;
    this.timers = options.timers ?? systemHeartbeatTimers;
  }

  /** Whether the interval is armed. */
  get running(): boolean {
    return this.handle !== null;
  }

  /** Start probing from the current time, replacing any previous interval. */
  start(): void {
    this.stop();
    this.lastSeen = this.timers.now();
    this.handle = this.timers.setInterval(() => this.tick(), this.options.intervalMs);
  }

  /** Record an inbound message, including a pong or a committed batch. */
  touch(): void {
    this.lastSeen = this.timers.now();
  }

  /** Stop probing without firing the timeout callback. */
  stop(): void {
    if (this.handle !== null) {
      this.timers.clearInterval(this.handle);
      this.handle = null;
    }
  }

  /** Send a ping or report one timeout, then leave the interval stopped. */
  private tick(): void {
    const now = this.timers.now();
    if (now - this.lastSeen > this.options.intervalMs + this.options.timeoutMs) {
      this.stop();
      this.options.onTimeout();
      return;
    }
    this.options.onPing();
  }
}
