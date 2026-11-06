/**
 * Pure lifetime rules for the transient notice stack.
 *
 * `ToastHost.tsx` owns rendering, timers, and pause/resume gestures. This module
 * owns the parts that must be identical in the browser and in tests: how long a
 * level lasts, when a row expires, how a repeated key merges into the row that is
 * already visible, and how manual dismissal and the row cap remove entries.
 *
 * All clocks are caller supplied. A row's `duration` of zero is sticky and never
 * expires; every other row expires at `startedAt + duration`.
 */

/** Lifetime for ordinary success and info notices. */
export const TOAST_DEFAULT_DURATION = 6000;
/** Lifetime for warnings, including missing assets. */
export const TOAST_WARNING_DURATION = 8000;
/** Lifetime for errors; still bounded, with the visible close control as an escape hatch. */
export const TOAST_ERROR_DURATION = 12000;
/** The number of rows the stack keeps before the oldest is evicted. */
export const TOAST_MAX_ROWS = 3;

/** The fields the lifetime rules need from one notice row. */
export interface ToastLifecycleRow {
  id: number;
  /** Notices sharing a key merge instead of stacking. */
  key?: string;
  level: string;
  /** Lifetime in milliseconds; zero keeps the row until the user dismisses it. */
  duration: number;
  /** Clock reading when the current lifetime began. */
  startedAt: number;
  /** Every row is dismissible; the host renders the visible close control from this. */
  closable: boolean;
  /** The row is playing its exit transition and no longer accepts a merge. */
  leaving?: boolean;
}

/** The outcome of adding one notice to the stack. */
export interface ToastInsertResult<T extends ToastLifecycleRow> {
  /** The next stack, including the new or merged row. */
  rows: T[];
  /** The row a caller should reveal and time. */
  row: T;
  /** True when the candidate merged into an existing keyed row. */
  merged: boolean;
  /** Rows pushed out by the cap; the caller must run their `onDismiss` callbacks. */
  evicted: T[];
}

/** The lifetime a level gets when the caller does not name one. */
export function toastDuration(level: string): number {
  if (level === "error") {
    return TOAST_ERROR_DURATION;
  }
  if (level === "warning") {
    return TOAST_WARNING_DURATION;
  }
  return TOAST_DEFAULT_DURATION;
}

/** Whether one row has reached the end of its lifetime at `now`. */
export function isToastExpired(
  row: Pick<ToastLifecycleRow, "duration" | "startedAt">,
  now: number,
): boolean {
  return row.duration > 0 && now - row.startedAt >= row.duration;
}

/** Rows whose lifetime is over but which have not started leaving yet. */
export function dueToasts<T extends ToastLifecycleRow>(rows: readonly T[], now: number): T[] {
  return rows.filter((row) => !row.leaving && isToastExpired(row, now));
}

/**
 * Add one notice, merging by key and enforcing the row cap.
 *
 * A keyed merge replaces the visible content and actions but keeps the existing
 * id and lifetime. Keeping the original timer prevents a repeated background
 * failure from pinning a row on screen indefinitely; the row still leaves at the
 * expiry of its first appearance.
 */
export function insertToast<T extends ToastLifecycleRow>(
  rows: readonly T[],
  candidate: T,
  limit = TOAST_MAX_ROWS,
): ToastInsertResult<T> {
  const key = candidate.key;
  if (key) {
    const existing = rows.find((row) => row.key === key && !row.leaving);
    if (existing) {
      const merged = {
        ...existing,
        ...candidate,
        id: existing.id,
        startedAt: existing.startedAt,
        duration: existing.duration,
        closable: true,
      } as T;
      return {
        rows: rows.map((row) => (row.id === existing.id ? merged : row)),
        row: merged,
        merged: true,
        evicted: [],
      };
    }
  }
  const cap = Math.max(1, Math.floor(limit));
  const overflow = Math.max(0, rows.length - (cap - 1));
  const evicted = rows.slice(0, overflow);
  const inserted = { ...candidate, closable: true } as T;
  return {
    rows: [...rows.slice(overflow), inserted],
    row: inserted,
    merged: false,
    evicted,
  };
}

/** Remove one row by id, returning it so its producer can release its handle. */
export function dismissToastRow<T extends ToastLifecycleRow>(
  rows: readonly T[],
  id: number,
): { rows: T[]; removed?: T } {
  return {
    rows: rows.filter((row) => row.id !== id),
    removed: rows.find((row) => row.id === id),
  };
}

/** Remove every row whose lifetime is over at `now`, returning those rows. */
export function expireToasts<T extends ToastLifecycleRow>(
  rows: readonly T[],
  now: number,
): { rows: T[]; expired: T[] } {
  const expired = dueToasts(rows, now);
  if (!expired.length) {
    return { rows: [...rows], expired };
  }
  const ids = new Set(expired.map((row) => row.id));
  return { rows: rows.filter((row) => !ids.has(row.id)), expired };
}
