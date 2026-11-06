/**
 * Owns cleanup callbacks and cancellation for one editor-runtime lifetime.
 *
 * This scope intentionally has a different contract from the Mod-owned scope:
 * editor cleanup runs in registration order so the composition root's teardown
 * order stays visible and stable, and `add` registers a scope-owned callback
 * rather than exposing an individual removal handle. Mod resources use their
 * own reverse-order, individually idempotent disposer contract.
 */

/** A teardown callback registered on a `ResourceScope`. */
export type Cleanup = () => void;

/**
 * Teardown owner for one editor runtime.
 *
 * Registrations run in insertion order on `dispose`; each registration cleanup
 * is owned by the scope. Event listeners added through `listen` are removed by
 * the same signal.
 */
export class ResourceScope {
  /** Registered cleanups in registration order. */
  cleanups: Set<Cleanup>;
  /** Aborted when the scope is disposed, releasing bound listeners. */
  controller: AbortController;
  /** Becomes true after the first dispose call. */
  disposed: boolean;

  /** Create an empty, undisposed scope with its own abort controller. */
  constructor() {
    this.cleanups = new Set();
    this.controller = new AbortController();
    this.disposed = false;
  }
  /** Register a cleanup, running it immediately when the scope is already disposed. */
  add(cleanup: Cleanup): Cleanup {
    if (this.disposed) {
      cleanup();
    } else {
      this.cleanups.add(cleanup);
    }
    return cleanup;
  }
  /** Register an event listener that is removed when this scope is disposed. */
  listen<K extends keyof GlobalEventHandlersEventMap>(
    target: EventTarget,
    type: K,
    callback: (event: GlobalEventHandlersEventMap[K]) => void,
    options?: boolean | AddEventListenerOptions,
  ): void;
  listen(
    target: EventTarget,
    type: string,
    callback: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ): void;
  listen(
    target: EventTarget,
    type: string,
    callback: EventListenerOrEventListenerObject,
    options: boolean | AddEventListenerOptions = {},
  ): void {
    const listenerOptions: AddEventListenerOptions =
      typeof options === "boolean" ? { capture: options } : options;
    target.addEventListener(type, callback, {
      ...listenerOptions,
      signal: this.controller.signal,
    });
  }
  /** Abort listeners and run every cleanup once; failures surface as one aggregate error. */
  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.controller.abort();
    const errors: unknown[] = [];
    for (const cleanup of this.cleanups) {
      try {
        cleanup();
      } catch (error) {
        errors.push(error);
      }
    }
    this.cleanups.clear();
    if (errors.length) {
      throw new AggregateError(errors, "Resource cleanup failed");
    }
  }
}
