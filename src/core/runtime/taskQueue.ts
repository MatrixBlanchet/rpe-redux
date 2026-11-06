/**
 * Bounded, prioritized async work scheduling.
 *
 * This is the lowest shared runtime layer: local service calls, protocol sends,
 * and collaboration transfers all need the same rules for concurrency, request
 * rate, deduplication, cancellation, and a maximum queue. The queue knows
 * nothing about HTTP, WebSockets, rooms, or React; callers pass a task and its
 * policy, and receive one promise per logical unit of work.
 *
 * `run` starts work immediately while capacity remains. A task that waits for a
 * token, a slot, or a higher-priority task is cancelled before it starts when
 * its signal aborts. A running task receives the same signal and is expected to
 * stop its own I/O when it fires; the queue still holds its slot until the task
 * settles so concurrency never exceeds the configured limit.
 */

/** Scheduling classes from most to least urgent. */
export type TaskPriority = "critical" | "high" | "normal" | "low";

/** Stable rank used by the queue; lower numbers run first. */
const PRIORITY_RANK: Readonly<Record<TaskPriority, number>> = Object.freeze({
  critical: 0,
  high: 1,
  normal: 2,
  low: 3,
});

/** Limits for one queue. */
export interface TaskQueueOptions {
  /** Tasks allowed to run at once. Defaults to 4. */
  readonly concurrency?: number;
  /** Sustained starts per second; 0 disables rate limiting. */
  readonly ratePerSecond?: number;
  /** Tokens available at once. Defaults to the rate, with a minimum of 1. */
  readonly burst?: number;
  /** Queued plus running tasks allowed before new work is rejected. */
  readonly maxQueued?: number;
}

/** Per-task scheduling policy. */
export interface TaskOptions {
  readonly priority?: TaskPriority;
  /** A key with a running or queued task returns that task instead of a new one. */
  readonly key?: string;
  /** Deadline measured from the moment the task starts running. */
  readonly timeoutMs?: number;
  /** Cancels the task before it starts, or aborts the running task's signal. */
  readonly signal?: AbortSignal;
}

/** Base failure for a task rejected by the queue itself. */
export class TaskQueueError extends Error {
  readonly code: string;

  /** Create a queue failure with a stable code. */
  constructor(message: string, code: string) {
    super(message);
    this.name = "TaskQueueError";
    this.code = code;
  }
}

/** The task was cancelled before completion. */
export class TaskAbortedError extends TaskQueueError {
  /** Create an aborted-task failure. */
  constructor(message = "The task was cancelled") {
    super(message, "task_aborted");
    this.name = "TaskAbortedError";
  }
}

/** The task exceeded its per-run deadline. */
export class TaskTimeoutError extends TaskQueueError {
  /** Create a timed-out task failure. */
  constructor(message = "The task exceeded its deadline") {
    super(message, "task_timeout");
    this.name = "TaskTimeoutError";
  }
}

/** The queue refused new work because its bound was reached or it was disposed. */
export class TaskQueueFullError extends TaskQueueError {
  /** Create an overflow or disposed-queue failure. */
  constructor(message: string, code = "task_queue_full") {
    super(message, code);
    this.name = "TaskQueueFullError";
  }
}

/** One logical task while it waits, runs, and settles. */
interface QueueEntry {
  readonly task: (signal: AbortSignal) => Promise<unknown>;
  readonly priority: TaskPriority;
  readonly sequence: number;
  readonly controller: AbortController;
  readonly key?: string;
  readonly timeoutMs?: number;
  readonly resolve: (value: unknown) => void;
  readonly reject: (error: unknown) => void;
  readonly promise: Promise<unknown>;
  externalSignal?: AbortSignal;
  externalAbort?: () => void;
  timeoutHandle: ReturnType<typeof setTimeout> | null;
  started: boolean;
  settled: boolean;
  holdsSlot: boolean;
}

/** Bounded priority queue for asynchronous work. */
export class TaskQueue {
  private readonly concurrency: number;
  private readonly ratePerSecond: number;
  private readonly burst: number;
  private readonly maxQueued: number;
  private readonly waiting: QueueEntry[] = [];
  private readonly running = new Set<QueueEntry>();
  private readonly keyed = new Map<string, Promise<unknown>>();
  private readonly timestamp = (): number => Date.now();
  private sequence = 0;
  private tokens: number;
  private lastRefill: number;
  private tokenTimer: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;

  /** Create an empty queue. Negative or non-finite limits fall back to defaults. */
  constructor(options: TaskQueueOptions = {}) {
    this.concurrency = positiveInteger(options.concurrency, 4);
    this.ratePerSecond = Math.max(0, finiteNumber(options.ratePerSecond, 0));
    this.burst = positiveNumber(options.burst, Math.max(1, Math.ceil(this.ratePerSecond)));
    this.maxQueued = positiveInteger(options.maxQueued, 256);
    this.tokens = this.ratePerSecond > 0 ? this.burst : 0;
    this.lastRefill = this.timestamp();
  }

  /** Tasks currently executing. */
  get active(): number {
    return this.running.size;
  }

  /** Tasks waiting for a slot or a rate token. */
  get queued(): number {
    return this.waiting.length;
  }

  /** Run one task under the queue policy, or return the matching keyed task. */
  run<T>(task: (signal: AbortSignal) => Promise<T>, options: TaskOptions = {}): Promise<T> {
    if (this.disposed) {
      return Promise.reject(
        new TaskQueueFullError("The task queue is disposed", "task_queue_disposed"),
      );
    }
    const key = options.key;
    if (key !== undefined) {
      const existing = this.keyed.get(key);
      if (existing) {
        return existing as Promise<T>;
      }
    }
    if (this.waiting.length + this.running.size >= this.maxQueued) {
      return Promise.reject(new TaskQueueFullError("The task queue is full"));
    }
    if (options.signal?.aborted) {
      return Promise.reject(new TaskAbortedError());
    }
    let resolve!: (value: unknown) => void;
    let reject!: (error: unknown) => void;
    const promise = new Promise<unknown>((resolvePromise, rejectPromise) => {
      resolve = resolvePromise;
      reject = rejectPromise;
    });
    const controller = new AbortController();
    const entry: QueueEntry = {
      task,
      priority: options.priority ?? "normal",
      sequence: this.sequence++,
      controller,
      ...(key === undefined ? {} : { key }),
      ...(options.timeoutMs === undefined ? {} : { timeoutMs: Math.max(1, options.timeoutMs) }),
      resolve,
      reject,
      promise,
      timeoutHandle: null,
      started: false,
      settled: false,
      holdsSlot: false,
    };
    if (options.signal) {
      const abort = () => this.cancel(entry);
      entry.externalSignal = options.signal;
      entry.externalAbort = abort;
      options.signal.addEventListener("abort", abort, { once: true });
    }
    if (key !== undefined) {
      this.keyed.set(key, promise);
    }
    this.waiting.push(entry);
    this.pump();
    return promise as Promise<T>;
  }

  /** Reject queued work, abort running signals, and stop accepting new work. */
  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.clearTokenTimer();
    const pending = this.waiting.splice(0);
    for (const entry of pending) {
      this.settle(
        entry,
        new TaskQueueFullError("The task queue is disposed", "task_queue_disposed"),
      );
    }
    for (const entry of [...this.running]) {
      if (!entry.settled) {
        entry.controller.abort();
      }
    }
  }

  /** Start as much waiting work as the slot and token budget allows. */
  private pump(): void {
    if (this.disposed) {
      return;
    }
    while (this.running.size < this.concurrency && this.waiting.length > 0) {
      if (this.ratePerSecond > 0) {
        const wait = this.takeToken();
        if (wait > 0) {
          this.scheduleTokenPump(wait);
          return;
        }
      }
      const entry = this.takeNext();
      if (!entry) {
        return;
      }
      this.start(entry);
    }
    if (this.waiting.length === 0) {
      this.clearTokenTimer();
    }
  }

  /** Remove and return the highest-priority waiting entry. */
  private takeNext(): QueueEntry | undefined {
    if (this.waiting.length === 0) {
      return undefined;
    }
    let best = 0;
    for (let index = 1; index < this.waiting.length; index += 1) {
      const candidate = this.waiting[index];
      const current = this.waiting[best];
      const candidateRank = PRIORITY_RANK[candidate.priority];
      const currentRank = PRIORITY_RANK[current.priority];
      if (
        candidateRank < currentRank ||
        (candidateRank === currentRank && candidate.sequence < current.sequence)
      ) {
        best = index;
      }
    }
    return this.waiting.splice(best, 1)[0];
  }

  /** Begin one entry and arrange its settlement. */
  private start(entry: QueueEntry): void {
    if (entry.settled) {
      return;
    }
    entry.started = true;
    entry.holdsSlot = true;
    this.running.add(entry);
    if (entry.timeoutMs !== undefined) {
      entry.timeoutHandle = setTimeout(() => {
        entry.timeoutHandle = null;
        this.fail(entry, new TaskTimeoutError(), true);
      }, entry.timeoutMs);
    }
    // An abort may land between the caller enqueueing and this task starting.
    if (entry.controller.signal.aborted) {
      this.fail(entry, new TaskAbortedError(), false);
      return;
    }
    void Promise.resolve()
      .then(() => entry.task(entry.controller.signal))
      .then(
        (value) => this.settle(entry, undefined, value),
        (error) => this.settle(entry, error),
      );
  }

  /** Refill the token bucket and consume one token, or report the delay to the next. */
  private takeToken(): number {
    const now = this.timestamp();
    const elapsed = Math.max(0, now - this.lastRefill);
    this.lastRefill = now;
    this.tokens = Math.min(this.burst, this.tokens + (elapsed / 1000) * this.ratePerSecond);
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return 0;
    }
    return Math.max(1, Math.ceil(((1 - this.tokens) / this.ratePerSecond) * 1000));
  }

  /** Schedule one pump at the next token, replacing any earlier token timer. */
  private scheduleTokenPump(delayMs: number): void {
    if (this.tokenTimer !== null) {
      return;
    }
    this.tokenTimer = setTimeout(() => {
      this.tokenTimer = null;
      this.pump();
    }, delayMs);
  }

  /** Cancel the rate-limit timer, if one is waiting. */
  private clearTokenTimer(): void {
    if (this.tokenTimer !== null) {
      clearTimeout(this.tokenTimer);
      this.tokenTimer = null;
    }
  }

  /** Cancel one queued or running task. */
  private cancel(entry: QueueEntry): void {
    if (entry.settled) {
      return;
    }
    if (!entry.started) {
      const index = this.waiting.indexOf(entry);
      if (index >= 0) {
        this.waiting.splice(index, 1);
      }
      this.settle(entry, new TaskAbortedError());
      this.pump();
      return;
    }
    this.fail(entry, new TaskAbortedError(), true);
  }

  /** Reject a running task immediately and abort its signal. */
  private fail(entry: QueueEntry, error: unknown, abort: boolean): void {
    if (entry.settled) {
      return;
    }
    if (abort) {
      entry.controller.abort();
    }
    this.settle(entry, error, undefined, entry.started && abort);
  }

  /**
   * Complete one entry, release its key and slot, and start the next task.
   *
   * `retainSlot` keeps the slot while an aborted task is still winding down;
   * the task's eventual settlement calls this method again and releases it.
   */
  private settle(entry: QueueEntry, error?: unknown, value?: unknown, retainSlot = false): void {
    if (entry.settled) {
      if (entry.holdsSlot) {
        entry.holdsSlot = false;
        this.running.delete(entry);
        this.pump();
      }
      return;
    }
    entry.settled = true;
    if (entry.timeoutHandle !== null) {
      clearTimeout(entry.timeoutHandle);
      entry.timeoutHandle = null;
    }
    if (entry.externalSignal && entry.externalAbort) {
      entry.externalSignal.removeEventListener("abort", entry.externalAbort);
    }
    if (entry.key !== undefined && this.keyed.get(entry.key) === entry.promise) {
      this.keyed.delete(entry.key);
    }
    if (error === undefined) {
      entry.resolve(value);
    } else {
      entry.reject(error);
    }
    if (!retainSlot && entry.holdsSlot) {
      entry.holdsSlot = false;
      this.running.delete(entry);
    }
    if (!retainSlot) {
      this.pump();
    }
  }
}

/** Clamp a finite number, using `fallback` for missing or non-finite input. */
function finiteNumber(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isFinite(value) ? value : fallback;
}

/** Clamp a positive integer, using `fallback` for missing or invalid input. */
function positiveInteger(value: number | undefined, fallback: number): number {
  const number = finiteNumber(value, fallback);
  return number >= 1 ? Math.floor(number) : fallback;
}

/** Clamp a positive number, using `fallback` for missing or invalid input. */
function positiveNumber(value: number | undefined, fallback: number): number {
  const number = finiteNumber(value, fallback);
  return number > 0 ? number : fallback;
}
