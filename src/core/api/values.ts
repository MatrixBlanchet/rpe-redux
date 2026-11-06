/**
 * Owns the value API anyone outside the app sees.
 *
 * The registry itself is `core/state/values.ts`. The host facade can read or
 * write any value by id; an Extension receives the capability-gated view from
 * `core/extensions/capabilityGate.ts`, which may write only values the same
 * package declared (its settings and its own `define` entries). Use a handle for
 * a known value and the explicit `byId` channel for dynamic IDs. The sandbox
 * exposes the same handles through an asynchronous bridge; definition callbacks
 * stay on the host because the registry invokes them synchronously.
 *
 * Minimal usage:
 * ```js
 * const enabled = redux.values.define({ id: "plugin.enabled", initial: false });
 * enabled.subscribe(() => console.log(enabled.get()));
 * enabled.set(true);
 * const playbackRate = redux.values.getHandle<string>("editor.rate");
 * playbackRate.subscribe(() => console.log(playbackRate.get()));
 * redux.values.byId.set("plugin.enabled", true);
 * ```
 */
import { values as valueRegistry } from "../state/values.ts";
import type { ValueHandle } from "../state/values.ts";

/**
 * The package-facing definition of a named value.
 *
 * Only the id and the initial value cross the public contract. The host keeps
 * persistence choices (`persist`, `storageKey`, `legacyStorageKey`) and the
 * validation callbacks internal, so a package cannot select a preference
 * section or adopt a host preference key.
 */
export interface PublicValueDefinition<T> {
  id: string;
  initial: T;
}

/** Dynamic access to named values by id. */
const byId = Object.freeze({
  /** Whether a value id is declared. */
  has: (id: string) => valueRegistry.has(id),
  /** The contributing package for an owned value, or undefined for host values. */
  ownerOf: (id: string) => valueRegistry.ownerOf(id),
  /** Read one value; throws when the id is not declared. */
  get: <T>(id: string): T => valueRegistry.get<T>(id),
  /** Write one value through its declared validation; throws when undeclared. */
  set: <T>(id: string, value: T) => valueRegistry.set(id, value),
  /** Merge object fields or replace a scalar value. */
  update: (id: string, partial: unknown) => valueRegistry.update(id, partial),

  /** Observe one value selected by a dynamic id. */
  subscribe: (id: string, listener: () => void) => valueRegistry.subscribeKey(id, listener),
  /** Observe the registry when any value changes. */
  subscribeAll: (listener: () => void) => valueRegistry.subscribe(listener),

  /** Every value that has moved away from its initial value, by id. */
  snapshot: () => valueRegistry.snapshot(),
});

/** Named values exposed to plugins; fixed ids use handles, dynamic ids use `byId`. */
export const values = Object.freeze({
  /** Declare a new named value; throws on a duplicate id. */
  define: <T>(definition: PublicValueDefinition<T>): ValueHandle<T> =>
    valueRegistry.define(definition),
  /** Read the handle for a declared value; throws when unknown. */
  getHandle: <T>(id: string): ValueHandle<T> => valueRegistry.getHandle<T>(id),
  byId,
});

export type { ValueHandle } from "../state/values.ts";
