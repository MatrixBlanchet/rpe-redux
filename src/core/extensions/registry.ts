/** Ordered, disposable dispatch for extension events and synchronous hooks. */

/** A synchronous extension callback; hooks return the same payload. */
export type ExtensionCallback<Payload> = (payload: Payload) => void;
/** Releases one registration; safe to call more than once. */
export type ExtensionDisposer = () => void;

/** Ordering and ownership for one subscription. */
export interface ExtensionSubscriptionOptions {
  priority?: number;
  owner?: string;
}

/** One callback failure reported to the runtime. */
export interface ExtensionCallbackFailure {
  channel: "event" | "hook";
  name: string;
  owner?: string;
  error: unknown;
}

/** Receives callback failures; the runtime logs and accounts for them. */
export type ExtensionFailureReporter = (failure: ExtensionCallbackFailure) => void;

interface ExtensionEntry {
  callback: (...args: never[]) => unknown;
  priority: number;
  sequence: number;
  owner?: string;
  active: boolean;
}

const noopReporter: ExtensionFailureReporter = () => {};

/** Detect async callbacks, which hooks do not await. */
function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  if ((typeof value !== "object" && typeof value !== "function") || value === null) {
    return false;
  }
  return "then" in value && typeof value.then === "function";
}

/**
 * Owns typed event and hook subscriptions without knowing editor semantics.
 *
 * Dispatch takes a snapshot. Removing a subscription during dispatch affects
 * later dispatches, while the current dispatch keeps its original order. Hooks
 * are intentionally synchronous: returned promises are not awaited and are
 * reported as callback failures.
 */
export class ExtensionRegistry<Events extends object, Hooks extends object> {
  private readonly events = new Map<keyof Events, ExtensionEntry[]>();
  private readonly hooks = new Map<keyof Hooks, ExtensionEntry[]>();
  private nextSequence = 0;
  private readonly reportFailure: ExtensionFailureReporter;

  /** Create a registry that reports callback failures through `reportFailure`. */
  constructor(reportFailure: ExtensionFailureReporter = noopReporter) {
    this.reportFailure = reportFailure;
  }

  /** Subscribe to one event; higher priority runs first, then registration order. */
  onEvent<K extends keyof Events>(
    name: K,
    callback: ExtensionCallback<Events[K]>,
    options: ExtensionSubscriptionOptions = {},
  ): ExtensionDisposer {
    return this.add(this.events, name, callback, options);
  }

  /** Subscribe to one synchronous hook with the same ordering rules as events. */
  onHook<K extends keyof Hooks>(
    name: K,
    callback: ExtensionCallback<Hooks[K]>,
    options: ExtensionSubscriptionOptions = {},
  ): ExtensionDisposer {
    return this.add(this.hooks, name, callback, options);
  }

  /** Dispatch one event to a snapshot of its subscribers. */
  emitEvent<K extends keyof Events>(name: K, payload: Events[K]): void {
    this.dispatch(this.events.get(name), "event", String(name), payload);
  }

  /** Dispatch one hook in place and return the payload subscribers may amend. */
  emitHook<K extends keyof Hooks>(name: K, payload: Hooks[K]): Hooks[K] {
    this.dispatch(this.hooks.get(name), "hook", String(name), payload);
    return payload;
  }

  /** Whether at least one subscriber is registered for this event. */
  hasEvent<K extends keyof Events>(name: K): boolean {
    return Boolean(this.events.get(name)?.length);
  }

  /** Whether at least one subscriber is registered for this hook. */
  hasHook<K extends keyof Hooks>(name: K): boolean {
    return Boolean(this.hooks.get(name)?.length);
  }

  /** Remove every registration owned by one extension and return its count. */
  removeOwner(owner: string): number {
    if (!owner.trim()) {
      throw new Error("Extension owner must not be empty");
    }
    return this.removeOwnerFrom(this.events, owner) + this.removeOwnerFrom(this.hooks, owner);
  }

  /** Insert one entry in priority order and return its idempotent disposer. */
  private add<K extends PropertyKey>(
    registry: Map<K, ExtensionEntry[]>,
    name: K,
    callback: (...args: never[]) => unknown,
    options: ExtensionSubscriptionOptions,
  ): ExtensionDisposer {
    const priority = options.priority ?? 0;
    if (!Number.isFinite(priority)) {
      throw new Error("Extension priority must be finite");
    }
    if (options.owner !== undefined && !options.owner.trim()) {
      throw new Error("Extension owner must not be empty");
    }

    const entry: ExtensionEntry = {
      callback,
      priority,
      sequence: this.nextSequence++,
      owner: options.owner,
      active: true,
    };
    const entries = registry.get(name) ?? [];
    entries.push(entry);
    entries.sort((left, right) => right.priority - left.priority || left.sequence - right.sequence);
    registry.set(name, entries);

    return () => {
      if (!entry.active) {
        return;
      }
      entry.active = false;
      const current = registry.get(name);
      if (!current) {
        return;
      }
      const index = current.indexOf(entry);
      if (index >= 0) {
        current.splice(index, 1);
      }
      if (!current.length) {
        registry.delete(name);
      }
    };
  }

  /** Call every snapshotted entry, isolating and reporting each failure. */
  private dispatch(
    entries: readonly ExtensionEntry[] | undefined,
    channel: "event" | "hook",
    name: string,
    payload: unknown,
  ): void {
    for (const entry of [...(entries ?? [])]) {
      try {
        const result = Reflect.apply(entry.callback, undefined, [payload]);
        if (isPromiseLike(result)) {
          this.reportFailure({
            channel,
            name,
            owner: entry.owner,
            error: new Error(
              "Extension callbacks must be synchronous; returned promise was ignored",
            ),
          });
          result.then(undefined, (error) => {
            this.reportFailure({ channel, name, owner: entry.owner, error });
          });
        }
      } catch (error) {
        this.reportFailure({ channel, name, owner: entry.owner, error });
      }
    }
  }

  /** Drop one owner's entries from a single registry and return the count. */
  private removeOwnerFrom<K extends PropertyKey>(
    registry: Map<K, ExtensionEntry[]>,
    owner: string,
  ): number {
    let removed = 0;
    for (const [name, entries] of registry) {
      const retained = entries.filter((entry) => {
        if (entry.owner !== owner) {
          return true;
        }
        entry.active = false;
        removed += 1;
        return false;
      });
      if (retained.length) {
        registry.set(name, retained);
      } else {
        registry.delete(name);
      }
    }
    return removed;
  }
}
