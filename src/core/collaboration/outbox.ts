/**
 * Bounded outgoing transaction queue for a room connection.
 *
 * Weak networks need three rules the old unbounded map could not express: a
 * hard entry and byte ceiling, a stable priority when the socket returns, and
 * age/attempt visibility for the timeout notice. The outbox stores caller-owned
 * values and never mutates them, so encrypted preparation can still fill the
 * wire form in place.
 */
import type { TaskPriority } from "../runtime/taskQueue.ts";

/** Metadata and value for one queued item. */
export interface OutboxEntry<T> {
  readonly id: string;
  readonly value: T;
  readonly priority: TaskPriority;
  readonly enqueuedAt: number;
  readonly bytes: number;
  readonly sequence: number;
  attempts: number;
}

/** Put policy for one item. */
export interface OutboxPutOptions {
  readonly priority?: TaskPriority;
  /** Estimated wire bytes; defaults to 0. */
  readonly bytes?: number;
}

/** Limits and clock for one outbox. */
export interface OutboxOptions {
  /** Maximum queued entries. Defaults to 512. */
  readonly maxEntries?: number;
  /** Maximum estimated bytes. Defaults to 8 MiB. */
  readonly maxBytes?: number;
  /** Clock used for `enqueuedAt`; defaults to `Date.now`. */
  readonly now?: () => number;
}

/** Result of adding one item. */
export type OutboxPutResult<T> =
  | { readonly ok: true; readonly entry: OutboxEntry<T> }
  | { readonly ok: false; readonly reason: "duplicate" | "full" };

/** Queue with stable ids, priorities, and bounded capacity. */
export class Outbox<T> {
  private readonly entries = new Map<string, OutboxEntry<T>>();
  private readonly maxEntries: number;
  private readonly maxBytes: number;
  private readonly now: () => number;
  private usedBytes = 0;
  private sequence = 0;

  /** Create an empty queue; invalid limits fall back to the defaults. */
  constructor(options: OutboxOptions = {}) {
    this.maxEntries = positiveInteger(options.maxEntries, 512);
    this.maxBytes = positiveInteger(options.maxBytes, 8 * 1024 * 1024);
    this.now = options.now ?? (() => Date.now());
  }

  /** Number of queued items. */
  get size(): number {
    return this.entries.size;
  }

  /** Sum of the estimated wire bytes of every queued item. */
  get bytes(): number {
    return this.usedBytes;
  }

  /** Whether an id is already queued. */
  has(id: string): boolean {
    return this.entries.has(id);
  }

  /** Read one queued item without changing its recency or attempts. */
  get(id: string): OutboxEntry<T> | undefined {
    return this.entries.get(id);
  }

  /** Read one queued value without exposing its queue metadata. */
  value(id: string): T | undefined {
    return this.entries.get(id)?.value;
  }

  /**
   * Add one item.
   *
   * A duplicate id is rejected without replacing the existing item, because a
   * retry must keep the original transaction id. A full queue is rejected as a
   * whole; the caller reports the failure and keeps its local history.
   */
  put(id: string, value: T, options: OutboxPutOptions = {}): OutboxPutResult<T> {
    if (this.entries.has(id)) {
      return { ok: false, reason: "duplicate" };
    }
    const bytes = nonNegativeInteger(options.bytes ?? 0);
    if (this.entries.size >= this.maxEntries || this.usedBytes + bytes > this.maxBytes) {
      return { ok: false, reason: "full" };
    }
    const entry: OutboxEntry<T> = {
      id,
      value,
      priority: options.priority ?? "normal",
      enqueuedAt: this.now(),
      bytes,
      sequence: this.sequence++,
      attempts: 0,
    };
    this.entries.set(id, entry);
    this.usedBytes += bytes;
    return { ok: true, entry };
  }

  /** Remove one item and release its byte estimate. */
  delete(id: string): boolean {
    const entry = this.entries.get(id);
    if (!entry) {
      return false;
    }
    this.entries.delete(id);
    this.usedBytes = Math.max(0, this.usedBytes - entry.bytes);
    return true;
  }

  /** Record one send attempt for timeout and diagnostics. */
  markAttempt(id: string): void {
    const entry = this.entries.get(id);
    if (entry) {
      entry.attempts += 1;
    }
  }

  /**
   * Queued items in retry order: undo/control first, then older items first.
   * The returned array is a snapshot; deleting from the outbox is the caller's
   * decision after the server acknowledges the item.
   */
  values(): readonly OutboxEntry<T>[] {
    return [...this.entries.values()].sort(
      (left, right) =>
        priorityRank(left.priority) - priorityRank(right.priority) ||
        left.sequence - right.sequence,
    );
  }

  /** Remove every item and reset the byte estimate. */
  clear(): void {
    this.entries.clear();
    this.usedBytes = 0;
  }
}

/** Numeric ordering for outbox priorities. */
function priorityRank(priority: TaskPriority): number {
  switch (priority) {
    case "critical":
      return 0;
    case "high":
      return 1;
    case "normal":
      return 2;
    case "low":
      return 3;
  }
}

/** Coerce a positive integer, falling back when missing or invalid. */
function positiveInteger(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isFinite(value) && value >= 1 ? Math.floor(value) : fallback;
}

/** Coerce a byte estimate to a non-negative integer. */
function nonNegativeInteger(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}
