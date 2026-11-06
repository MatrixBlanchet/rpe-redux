/**
 * Cooperative lease rules for chart, judge-line, and object scopes.
 *
 * The room server and the client both reason about the same leases. Keeping the
 * all-or-nothing acquisition, chart-wide blocking, expiry sweep, and ownership
 * checks here means a transport change cannot silently weaken the lock model.
 */
import type { RoomLock } from "./types.ts";

/** Default lease lifetime for an interactive edit. */
export const DEFAULT_LEASE_TTL_MS = 15_000;
/** Shortest and longest lease a client may request. */
export const MIN_LEASE_TTL_MS = 1_000;
export const MAX_LEASE_TTL_MS = 60_000;
/** Maximum number of targets in one all-or-nothing request. */
export const MAX_LEASE_TARGETS = 64;

/** One lease request after validation. */
export interface LeaseAcquireOptions {
  /** Requested lifetime; clamped to the protocol range. */
  readonly ttlMs?: number;
  /** Clock value used for expiry; defaults to `Date.now()`. */
  readonly now?: number;
  /** Maximum distinct targets kept from the request. */
  readonly maxTargets?: number;
}

/** All-or-nothing acquisition result. */
export type LeaseAcquireResult =
  | { readonly ok: true; readonly leases: readonly RoomLock[] }
  | {
      readonly ok: false;
      readonly reason: "empty" | "locked";
      readonly conflicts: readonly RoomLock[];
    };

/** Scope encoded by one lease id. */
export function leaseScope(id: string): RoomLock["scope"] {
  if (id === "chart") {
    return "chart";
  }
  return id.startsWith("line:") ? "line" : "object";
}

/** Deduplicate and bound a requested lease set. */
function normalizeTargets(requested: readonly string[], maxTargets: number): string[] {
  const ids = new Set<string>();
  for (const value of requested) {
    if (typeof value !== "string") {
      continue;
    }
    if (value.length === 0 || value.length > 160) {
      continue;
    }
    ids.add(value);
    if (ids.size >= maxTargets) {
      break;
    }
  }
  return [...ids];
}

/** Leases that block `ownerId` from taking every id in `requested`. */
export function leaseConflicts(
  locks: ReadonlyMap<string, RoomLock>,
  ownerId: string,
  requested: readonly string[],
  now = Date.now(),
): RoomLock[] {
  const requestedSet = new Set(requested);
  const conflicts: RoomLock[] = [];
  const chart = locks.get("chart");
  if (chart && chart.ownerId !== ownerId && chart.expiresAt > now && !requestedSet.has("chart")) {
    conflicts.push(chart);
  }
  for (const id of requestedSet) {
    const lock = locks.get(id);
    if (lock && lock.ownerId !== ownerId && lock.expiresAt > now) {
      conflicts.push(lock);
    }
  }
  if (requestedSet.has("chart")) {
    for (const lock of locks.values()) {
      if (lock.id !== "chart" && lock.ownerId !== ownerId && lock.expiresAt > now) {
        conflicts.push(lock);
      }
    }
  }
  return conflicts;
}

/**
 * Acquire every requested lease or none of them.
 *
 * Existing leases owned by `ownerId` are replaced with the new expiry. A chart
 * lease blocks every other target; requesting `chart` blocks every other lease.
 * Expired leases are ignored and removed from the map.
 */
export function acquireLeases(
  locks: Map<string, RoomLock>,
  ownerId: string,
  requested: readonly string[],
  options: LeaseAcquireOptions = {},
): LeaseAcquireResult {
  const ids = normalizeTargets(requested, options.maxTargets ?? MAX_LEASE_TARGETS);
  if (ids.length === 0) {
    return { ok: false, reason: "empty", conflicts: [] };
  }
  const now = options.now ?? Date.now();
  sweepExpiredLeases(locks, now);
  const conflicts = leaseConflicts(locks, ownerId, ids, now);
  if (conflicts.length > 0) {
    return { ok: false, reason: "locked", conflicts };
  }
  const ttl = Math.min(
    MAX_LEASE_TTL_MS,
    Math.max(MIN_LEASE_TTL_MS, Math.trunc(options.ttlMs ?? DEFAULT_LEASE_TTL_MS)),
  );
  const leases = ids.map((id) =>
    Object.freeze({
      id,
      ownerId,
      scope: leaseScope(id),
      expiresAt: now + ttl,
    } satisfies RoomLock),
  );
  for (const lease of leases) {
    locks.set(lease.id, lease);
  }
  return { ok: true, leases: Object.freeze(leases) };
}

/** Release the named leases owned by `ownerId`; returns how many were removed. */
export function releaseLeases(
  locks: Map<string, RoomLock>,
  ownerId: string,
  ids: readonly string[],
): number {
  let released = 0;
  for (const id of ids) {
    const lock = locks.get(id);
    if (lock?.ownerId === ownerId) {
      locks.delete(id);
      released += 1;
    }
  }
  return released;
}

/** Release every lease owned by one member; used on removal, downgrade, and leave. */
export function releaseOwnerLeases(locks: Map<string, RoomLock>, ownerId: string): number {
  let released = 0;
  for (const [id, lock] of locks) {
    if (lock.ownerId === ownerId) {
      locks.delete(id);
      released += 1;
    }
  }
  return released;
}

/** Remove expired leases and return how many were removed. */
export function sweepExpiredLeases(locks: Map<string, RoomLock>, now = Date.now()): number {
  let removed = 0;
  for (const [id, lock] of locks) {
    if (lock.expiresAt <= now) {
      locks.delete(id);
      removed += 1;
    }
  }
  return removed;
}

/** Active leases copied out of the ledger. */
export function activeLeases(
  locks: ReadonlyMap<string, RoomLock>,
  now = Date.now(),
): readonly RoomLock[] {
  return Object.freeze(
    [...locks.values()]
      .filter((lock) => lock.expiresAt > now)
      .map((lock) => Object.freeze({ ...lock })),
  );
}

/** Leases still held by `ownerId` after the expired entries are ignored. */
export function heldLeases(
  locks: ReadonlyMap<string, RoomLock>,
  ownerId: string,
  ids: readonly string[],
  now = Date.now(),
): readonly string[] {
  const held: string[] = [];
  for (const id of new Set(ids)) {
    const lock = locks.get(id);
    if (lock && lock.ownerId === ownerId && lock.expiresAt > now) {
      held.push(id);
    }
  }
  return held;
}

/** Lease ids a caller requested but no longer holds or never held. */
export function missingLeases(
  locks: ReadonlyMap<string, RoomLock>,
  ownerId: string,
  ids: readonly string[],
  now = Date.now(),
): readonly string[] {
  const held = new Set(heldLeases(locks, ownerId, ids, now));
  return [...new Set(ids)].filter((id) => !held.has(id));
}

/** Active leases that belong to another member and cover one of `ids`. */
export function foreignLeases(
  locks: ReadonlyMap<string, RoomLock>,
  ownerId: string,
  ids: readonly string[],
  now = Date.now(),
): readonly RoomLock[] {
  const matches: RoomLock[] = [];
  for (const id of new Set(ids)) {
    const lock = locks.get(id);
    if (lock && lock.ownerId !== ownerId && lock.expiresAt > now) {
      matches.push(lock);
    }
  }
  return matches;
}
