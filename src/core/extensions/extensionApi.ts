/**
 * Bridges the host-installed complete Redux facade into sandbox bridge calls
 * and keeps the per-owner capability usage ledger.
 *
 * The ledger is host-side only: packages never receive it, and the host reads
 * it through `extensionCapabilityUsage()` for audits and tests.
 */
import type { ReduxApi } from "../api/index.ts";
import { createLateBound } from "../utils/lateBound.ts";
import type { ExtensionCapability } from "./capabilities.ts";

const extensionApiBinding = createLateBound<ReduxApi>();

/** Connect the complete public facade before packaged Extensions are enabled. */
export function connectExtensionApi(api: ReduxApi): () => void {
  return extensionApiBinding.bind(api);
}

/** Resolve the complete public facade for one sandbox bridge call. */
export function requireExtensionApi(): ReduxApi {
  const api = extensionApiBinding.value();
  if (!api) {
    throw new Error("The complete Redux API is unavailable to this Extension host");
  }
  return api;
}

/** Whether one capability check succeeded or was refused. */
export type ExtensionCapabilityOutcome = "used" | "denied";

/** Read-only usage record for one loaded package. */
export interface ExtensionCapabilityUsageSnapshot {
  /** Capabilities the current manifest declares. */
  readonly declared: readonly ExtensionCapability[];
  /** Successful uses keyed by capability. */
  readonly observed: Readonly<Record<string, number>>;
  /** Refused uses keyed by capability. */
  readonly denied: Readonly<Record<string, number>>;
}

interface MutableCapabilityUsage {
  declared: Set<ExtensionCapability>;
  observed: Map<string, number>;
  denied: Map<string, number>;
}

const capabilityUsage = new Map<string, MutableCapabilityUsage>();
const loggedDenials = new Set<string>();

/** Return the mutable record for one owner, creating it on first use. */
function usageOf(owner: string): MutableCapabilityUsage {
  let usage = capabilityUsage.get(owner);
  if (!usage) {
    usage = { declared: new Set(), observed: new Map(), denied: new Map() };
    capabilityUsage.set(owner, usage);
  }
  return usage;
}

/** Replace the declared list for one owner while keeping its counters. */
export function registerExtensionCapabilities(
  owner: string,
  declared: Iterable<ExtensionCapability>,
): void {
  usageOf(owner).declared = new Set(declared);
}

/** Count one successful or refused capability check for one owner. */
export function recordExtensionCapability(
  owner: string,
  capability: ExtensionCapability,
  outcome: ExtensionCapabilityOutcome,
): void {
  const usage = usageOf(owner);
  const counts = outcome === "used" ? usage.observed : usage.denied;
  counts.set(capability, (counts.get(capability) ?? 0) + 1);
}

/**
 * Write one structured host log for a refused `api.call`.
 *
 * A package can probe the same denied member repeatedly; the ledger counts
 * every refusal while the log records each owner/capability/action once.
 */
export function logExtensionCapabilityDenial(
  owner: string,
  capability: ExtensionCapability,
  action: string,
): void {
  const key = `${owner}\u0000${capability}\u0000${action}`;
  if (loggedDenials.has(key)) {
    return;
  }
  loggedDenials.add(key);
  console.warn("[redux.extensions] capability denied", {
    extension: owner,
    capability,
    action,
    code: "capabilityDenied",
  });
}

/** Snapshot the capability ledger, optionally for one owner only. */
export function extensionCapabilityUsage(
  owner?: string,
): Readonly<Record<string, ExtensionCapabilityUsageSnapshot>> {
  const snapshot: Record<string, ExtensionCapabilityUsageSnapshot> = {};
  for (const [id, usage] of capabilityUsage) {
    if (owner !== undefined && id !== owner) {
      continue;
    }
    snapshot[id] = Object.freeze({
      declared: Object.freeze([...usage.declared].sort()),
      observed: Object.freeze(
        Object.fromEntries(
          [...usage.observed].sort(([left], [right]) => left.localeCompare(right)),
        ),
      ),
      denied: Object.freeze(
        Object.fromEntries([...usage.denied].sort(([left], [right]) => left.localeCompare(right))),
      ),
    });
  }
  return Object.freeze(snapshot);
}

/** Clear the ledger and the denial log; tests call this between fixtures. */
export function resetExtensionCapabilityUsage(): void {
  capabilityUsage.clear();
  loggedDenials.clear();
}
