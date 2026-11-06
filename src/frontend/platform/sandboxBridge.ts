/**
 * Resource budgets and handle tables for the Extension sandbox bridge.
 *
 * The iframe may send package-sized values back to the host, and host results
 * may be just as large. Every decoded request, cloned response, and encoded
 * result is bounded by depth, node count, and bytes; exceeding a limit throws a
 * structured `BridgeBudgetError` so the RPC layer can return an error instead of
 * exhausting the host heap. Value handles receive one stable bridge id each and
 * the table clears when the owning sandbox is disposed.
 */
import type { ValueHandle } from "../../core/state/values.ts";

/** Limits applied to one bridge value traversal. */
export interface BridgeLimits {
  /** Maximum object or array nesting, counting the root as depth zero. */
  readonly depth: number;
  /** Maximum values visited in one traversal. */
  readonly nodes: number;
  /** Maximum estimated bytes retained by one traversal. */
  readonly bytes: number;
  /** Maximum length of one array or byte payload. */
  readonly arrayLength: number;
  /** Maximum length of one string, in UTF-16 code units. */
  readonly stringLength: number;
}

/** Default per-value limits for both directions of the bridge. */
export const BRIDGE_LIMITS: BridgeLimits = Object.freeze({
  depth: 32,
  nodes: 500_000,
  bytes: 16_000_000,
  arrayLength: 2_000_000,
  stringLength: 8_000_000,
});

/** Which budget rejected a value. */
export type BridgeBudgetKind = "depth" | "nodes" | "bytes" | "array" | "string";

/**
 * Structured failure raised when one bridge value exceeds its budget.
 *
 * The `code` and `details` fields survive the RPC error envelope, so package
 * code sees `bridge.limit` instead of an opaque string or a failed host.
 */
export class BridgeBudgetError extends Error {
  readonly code = "bridge.limit";
  readonly kind: BridgeBudgetKind;
  readonly limit: number;
  readonly details: Readonly<{ kind: BridgeBudgetKind; limit: number }>;

  /** Build one budget failure for the limit that was crossed. */
  constructor(kind: BridgeBudgetKind, limit: number) {
    super(`Extension bridge ${kind} budget exceeded: ${limit}`);
    this.name = "BridgeBudgetError";
    this.kind = kind;
    this.limit = limit;
    this.details = Object.freeze({ kind, limit });
  }
}

/** Mutable accounting for one traversal; limits stay fixed. */
export interface BridgeBudget {
  readonly limits: BridgeLimits;
  bytes: number;
  nodes: number;
}

/** Create accounting for one traversal, optionally with test-sized limits. */
export function createBridgeBudget(overrides: Partial<BridgeLimits> = {}): BridgeBudget {
  return {
    limits: Object.freeze({ ...BRIDGE_LIMITS, ...overrides }),
    bytes: 0,
    nodes: 0,
  };
}

/** Hooks that let the host restore callbacks while decoding iframe arguments. */
export interface BridgeDecodeHooks {
  /** Rebuild one host callback from its bridge id. */
  callback?(id: number): (...args: unknown[]) => void;
}

/** Hooks that let the host replace handles and disposers before cloning. */
export interface BridgeCloneHooks {
  /** Return a bridge marker for a value handle, or undefined for other objects. */
  valueHandle?(value: unknown): unknown | undefined;
  /** Return a bridge marker for a returned disposer, or undefined to drop it. */
  function?(value: (...args: never[]) => unknown): unknown | undefined;
}

/** Charge one visited value. */
function chargeNode(budget: BridgeBudget): void {
  budget.nodes += 1;
  if (budget.nodes > budget.limits.nodes) {
    throw new BridgeBudgetError("nodes", budget.limits.nodes);
  }
}

/** Charge estimated retained bytes. */
function chargeBytes(budget: BridgeBudget, bytes: number): void {
  budget.bytes += Math.max(0, bytes);
  if (budget.bytes > budget.limits.bytes) {
    throw new BridgeBudgetError("bytes", budget.limits.bytes);
  }
}

/** Charge one string by its UTF-16 size and per-string length limit. */
function chargeString(budget: BridgeBudget, value: string): void {
  if (value.length > budget.limits.stringLength) {
    throw new BridgeBudgetError("string", budget.limits.stringLength);
  }
  chargeBytes(budget, value.length * 2);
}

/** Charge one array or byte payload by element count and per-array length. */
function chargeArray(budget: BridgeBudget, length: number): void {
  if (length > budget.limits.arrayLength) {
    throw new BridgeBudgetError("array", budget.limits.arrayLength);
  }
  chargeBytes(budget, length * 8);
}

/**
 * Decode one iframe value under a single cumulative budget.
 *
 * Byte payloads become `Uint8Array`, callback markers become host functions,
 * and object keys that could rewrite a prototype are dropped. The budget is
 * shared by every nested value, so many individually small entries cannot add
 * up to an unbounded request.
 */
export function decodeBridgeArgs(
  value: unknown,
  hooks: BridgeDecodeHooks = {},
  budget: BridgeBudget = createBridgeBudget(),
  depth = 0,
): unknown {
  if (depth > budget.limits.depth) {
    throw new BridgeBudgetError("depth", budget.limits.depth);
  }
  chargeNode(budget);
  if (typeof value === "string") {
    chargeString(budget, value);
    return value;
  }
  if (Array.isArray(value)) {
    chargeArray(budget, value.length);
    return value.map((entry) => decodeBridgeArgs(entry, hooks, budget, depth + 1));
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (Array.isArray(record.__bytes)) {
      const bytes = record.__bytes;
      chargeArray(budget, bytes.length);
      return Uint8Array.from(bytes as number[]);
    }
    if (typeof record.__callback === "number") {
      const callback = hooks.callback?.(record.__callback);
      if (!callback) {
        throw new Error("Extension bridge callback is not available");
      }
      chargeBytes(budget, 16);
      return callback;
    }
    const decoded: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(record)) {
      if (key === "__proto__") {
        continue;
      }
      chargeString(budget, key);
      chargeBytes(budget, 16);
      decoded[key] = decodeBridgeArgs(entry, hooks, budget, depth + 1);
    }
    return decoded;
  }
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    chargeBytes(budget, 8);
  }
  return value;
}

/**
 * Clone one host value into the structured-clone subset the sandbox accepts.
 *
 * Functions become `undefined` unless a disposer hook supplies a marker,
 * typed arrays become `__bytes`, dates become ISO strings, and every value
 * consumes the same depth/node/byte budget. A cyclic value therefore fails on
 * the depth limit instead of overflowing the host stack.
 */
export function cloneForSandbox(
  value: unknown,
  hooks: BridgeCloneHooks = {},
  budget: BridgeBudget = createBridgeBudget(),
  depth = 0,
): unknown {
  if (depth > budget.limits.depth) {
    throw new BridgeBudgetError("depth", budget.limits.depth);
  }
  chargeNode(budget);
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof value === "function") {
    const marker = hooks.function?.(value as (...args: never[]) => unknown);
    if (marker === undefined) {
      return undefined;
    }
    chargeBytes(budget, 32);
    return marker;
  }
  if (typeof value !== "object") {
    if (typeof value === "string") {
      chargeString(budget, value);
    } else if (
      typeof value === "number" ||
      typeof value === "boolean" ||
      typeof value === "bigint"
    ) {
      chargeBytes(budget, 8);
    }
    return value;
  }
  const handleMarker = hooks.valueHandle?.(value);
  if (handleMarker !== undefined) {
    chargeBytes(budget, 32);
    return handleMarker;
  }
  if (value instanceof Uint8Array) {
    chargeArray(budget, value.byteLength);
    return { __bytes: Array.from(value) };
  }
  if (value instanceof ArrayBuffer) {
    chargeArray(budget, value.byteLength);
    return { __bytes: Array.from(new Uint8Array(value)) };
  }
  if (ArrayBuffer.isView(value)) {
    const bytes = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    chargeArray(budget, bytes.byteLength);
    return { __bytes: Array.from(bytes) };
  }
  if (Array.isArray(value)) {
    chargeArray(budget, value.length);
    return value.map((entry) => cloneForSandbox(entry, hooks, budget, depth + 1));
  }
  if (value instanceof Date) {
    const iso = value.toISOString();
    chargeString(budget, iso);
    return iso;
  }
  const cloned: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (key === "__proto__") {
      continue;
    }
    const next = cloneForSandbox(entry, hooks, budget, depth + 1);
    if (next === undefined) {
      continue;
    }
    chargeString(budget, key);
    chargeBytes(budget, 16);
    cloned[key] = next;
  }
  return cloned;
}

/** Encode one host API result under a fresh result budget. */
export function encodeBridgeResult(
  value: unknown,
  hooks: BridgeCloneHooks = {},
  budget: BridgeBudget = createBridgeBudget(),
): unknown {
  return cloneForSandbox(value, hooks, budget);
}

/** A value handle marker returned to the iframe. */
export interface SandboxValueHandleMarker {
  readonly __valueHandle: string;
  readonly id: string;
}

/** Host-side table of value handles exposed to one sandbox instance. */
export interface SandboxValueHandleTable {
  /** Return the stable marker for a handle, registering it on first use. */
  encode(handle: ValueHandle<unknown>): SandboxValueHandleMarker;
  /** Resolve a marker issued by this sandbox, or throw when it is unknown. */
  require(id: unknown): ValueHandle<unknown>;
  /** Forget one marker; returns whether it was registered. */
  release(id: unknown): boolean;
  /** Forget every marker; the value registry itself is not modified. */
  clear(): void;
}

/** Build the value-handle table for one sandbox, using its id source. */
export function createSandboxValueHandleTable(nextId: () => number): SandboxValueHandleTable {
  const byBridgeId = new Map<string, ValueHandle<unknown>>();
  const byValueId = new Map<string, string>();
  return {
    encode(handle) {
      let bridgeId = byValueId.get(handle.id);
      if (bridgeId === undefined) {
        bridgeId = `value:${nextId()}`;
        byValueId.set(handle.id, bridgeId);
        byBridgeId.set(bridgeId, handle);
      }
      return { __valueHandle: bridgeId, id: handle.id };
    },
    require(id) {
      const handle = byBridgeId.get(String(id));
      if (!handle) {
        throw new Error("Extension value handle is not available");
      }
      return handle;
    },
    release(id) {
      const bridgeId = String(id);
      const handle = byBridgeId.get(bridgeId);
      if (!handle) {
        return false;
      }
      byBridgeId.delete(bridgeId);
      byValueId.delete(handle.id);
      return true;
    },
    clear() {
      byBridgeId.clear();
      byValueId.clear();
    },
  };
}
