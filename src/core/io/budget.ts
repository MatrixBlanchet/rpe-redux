/**
 * Byte quotas for local caches, rooms, and staged uploads.
 *
 * A budget reserves capacity before bytes are accepted, so two concurrent
 * writers cannot both observe the same free space. It is intentionally pure:
 * callers decide what happens at a warning threshold or when a reservation
 * fails, and no host filesystem probe is implied.
 */

/** How close a budget is to its limit. */
export type BudgetPressure = "normal" | "warning" | "full";

/** Construction values for one budget. */
export interface ByteBudgetOptions {
  /** Maximum bytes the budget may hold. */
  readonly limit: number;
  /** Bytes already committed before this budget was created. */
  readonly used?: number;
  /** Fraction of the limit at which `pressure` becomes `warning`. */
  readonly warningAt?: number;
}

/** Integer byte accounting with all-or-nothing reservations. */
export class ByteBudget {
  private readonly capacity: number;
  private readonly warningAt: number;
  private usedBytes: number;

  /** Create a budget; negative or non-finite values clamp to zero. */
  constructor(options: ByteBudgetOptions) {
    this.capacity = nonNegativeInteger(options.limit);
    this.usedBytes = Math.min(this.capacity, nonNegativeInteger(options.used ?? 0));
    this.warningAt = Math.min(1, Math.max(0, finiteNumber(options.warningAt, 0.9)));
  }

  /** Maximum bytes this budget may hold. */
  get limit(): number {
    return this.capacity;
  }

  /** Bytes currently reserved. */
  get used(): number {
    return this.usedBytes;
  }

  /** Bytes still available. */
  get available(): number {
    return Math.max(0, this.capacity - this.usedBytes);
  }

  /** Whether the budget is normal, near its limit, or full. */
  get pressure(): BudgetPressure {
    if (this.usedBytes >= this.capacity) {
      return "full";
    }
    return this.usedBytes >= this.capacity * this.warningAt ? "warning" : "normal";
  }

  /** Whether `bytes` fits without changing the budget. */
  canFit(bytes: number): boolean {
    const size = nonNegativeInteger(bytes);
    return size <= this.available;
  }

  /** Reserve `bytes` when they fit; returns whether the reservation was made. */
  reserve(bytes: number): boolean {
    const size = nonNegativeInteger(bytes);
    if (!this.canFit(size)) {
      return false;
    }
    this.usedBytes += size;
    return true;
  }

  /** Return capacity after a reservation is discarded or a file is removed. */
  release(bytes: number): void {
    this.usedBytes = Math.max(0, this.usedBytes - nonNegativeInteger(bytes));
  }
}

/** Coerce a missing or non-finite number to `fallback`. */
function finiteNumber(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isFinite(value) ? value : fallback;
}

/** Coerce a byte count to a non-negative integer. */
function nonNegativeInteger(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}
