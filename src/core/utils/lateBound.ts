/**
 * A single-slot late-bound value used by mounted capability adapters.
 *
 * `bind` replaces the current value and returns an idempotent disposer. A
 * disposer cannot clear a newer binding. `value` is null while the host is
 * unmounted.
 */
export interface LateBound<T> {
  bind(value: T): () => void;
  value(): T | null;
}

/** Create an empty slot whose disposer only clears its own binding. */
export function createLateBound<T>(): LateBound<T> {
  let current: { value: T; token: object } | null = null;
  return {
    bind(value) {
      const token = {};
      current = { value, token };
      let active = true;
      return () => {
        if (active && current?.token === token) {
          active = false;
          current = null;
        }
      };
    },
    value: () => current?.value ?? null,
  };
}
