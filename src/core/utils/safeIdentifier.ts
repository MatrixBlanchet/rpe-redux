/**
 * Identifier rules for values, settings, and persisted keys.
 *
 * These ids are used as object keys in the preference document and in value
 * snapshots. Rejecting the Object prototype names keeps a contributed id from
 * becoming a setter for `Object.prototype`; the length bound keeps a malformed
 * package from creating an unbounded key.
 */
const RESERVED_KEYS: ReadonlySet<string> = new Set(["__proto__", "constructor", "prototype"]);

/** The longest id a setting, value, or storage key may use. */
export const MAX_IDENTIFIER_LENGTH = 128;

/** Accept a bounded, trimmed identifier that is not an Object prototype name. */
export function isSafeIdentifier(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= MAX_IDENTIFIER_LENGTH &&
    value.trim() === value &&
    !value.includes("\0") &&
    !RESERVED_KEYS.has(value)
  );
}

/** Throw a stable error before a malformed id reaches a preference object. */
export function assertSafeIdentifier(value: unknown, kind: string): asserts value is string {
  if (!isSafeIdentifier(value)) {
    throw new TypeError(`${kind} must be a non-empty, bounded identifier: ${String(value)}`);
  }
}
