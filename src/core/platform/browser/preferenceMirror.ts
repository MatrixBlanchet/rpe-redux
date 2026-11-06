/**
 * The synchronous storage mirror behind the preference store.
 *
 * `browserMirror` returns null when `localStorage` is missing or throws, and
 * `memoryMirror` supplies an in-memory fallback for tests and restricted hosts.
 */
/** localStorage key holding the mirrored preference document. */
export const MIRROR_KEY = "redux:preferences";

/** The synchronous `getItem`/`setItem` storage a preference store mirrors into. */
export interface PreferenceMirror {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** Create an in-memory mirror for tests and hosts without `localStorage`. */
export function memoryMirror(): PreferenceMirror {
  const cells = new Map<string, string>();
  return {
    getItem: (key) => (cells.has(key) ? (cells.get(key) as string) : null),
    setItem: (key, value) => cells.set(key, value),
  };
}

/** Use `localStorage` when it is present and usable, otherwise return null. */
export function browserMirror(): PreferenceMirror | null {
  try {
    const storage = globalThis.localStorage;
    if (!storage) {
      return null;
    }
    // Touch the API: a present-but-throwing localStorage counts as absent.
    storage.getItem(MIRROR_KEY);
    return storage;
  } catch {
    return null;
  }
}
