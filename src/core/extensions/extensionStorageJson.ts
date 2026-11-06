/**
 * JSON encoding helpers for the owner-scoped Extension storage handle.
 *
 * The host keeps storage as strings. These helpers validate that a package
 * value is plain JSON before serializing it, keep the existing 256 KB bound,
 * and treat unparseable stored text as a missing value rather than a package
 * crash.
 */

/** Maximum byte length of one stored Extension value, shared with string writes. */
export const MAX_EXTENSION_STORE_VALUE_BYTES = 256_000;

/** Stable failure codes carried by `ExtensionStorageJsonError`. */
export type ExtensionStorageJsonErrorCode = "storageValueNotJson" | "storageValueTooLarge";

/** A rejected storage JSON value with a stable code for the sandbox bridge. */
export class ExtensionStorageJsonError extends Error {
  readonly code: ExtensionStorageJsonErrorCode;

  /** Build one JSON storage failure. */
  constructor(code: ExtensionStorageJsonErrorCode, message: string) {
    super(message);
    this.name = "ExtensionStorageJsonError";
    this.code = code;
  }
}

/** Maximum nesting accepted before serialization, matching the bridge depth. */
const MAX_JSON_DEPTH = 32;

/** Whether a value is a plain object with only own enumerable data properties. */
function isPlainObject(value: object): boolean {
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/** Reject circular graphs, host objects, and non-JSON primitives before stringify. */
function isJsonValue(value: unknown, ancestors: Set<object>, depth: number): boolean {
  if (depth > MAX_JSON_DEPTH) {
    return false;
  }
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return true;
  }
  if (typeof value === "number") {
    return Number.isFinite(value);
  }
  if (typeof value !== "object") {
    return false;
  }
  if (ancestors.has(value)) {
    return false;
  }
  if (!Array.isArray(value) && !isPlainObject(value)) {
    return false;
  }
  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      for (let index = 0; index < value.length; index += 1) {
        if (!(index in value) || !isJsonValue(value[index], ancestors, depth + 1)) {
          return false;
        }
      }
      return true;
    }
    return Object.values(value).every((entry) => isJsonValue(entry, ancestors, depth + 1));
  } finally {
    ancestors.delete(value);
  }
}

/**
 * Serialize one JSON value for storage.
 *
 * A non-JSON value throws `storageValueNotJson`; an encoded string over 256 KB
 * throws `storageValueTooLarge` before it reaches the preference store.
 */
export function encodeExtensionStorageJson(value: unknown): string {
  if (!isJsonValue(value, new Set(), 0)) {
    throw new ExtensionStorageJsonError(
      "storageValueNotJson",
      "Extension storage value must be JSON data",
    );
  }
  const text = JSON.stringify(value);
  if (typeof text !== "string") {
    throw new ExtensionStorageJsonError(
      "storageValueNotJson",
      "Extension storage value must be JSON data",
    );
  }
  if (new TextEncoder().encode(text).byteLength > MAX_EXTENSION_STORE_VALUE_BYTES) {
    throw new ExtensionStorageJsonError(
      "storageValueTooLarge",
      `Extension stored JSON exceeds ${MAX_EXTENSION_STORE_VALUE_BYTES} bytes`,
    );
  }
  return text;
}

/**
 * Parse one stored value, or return null when it is missing or invalid.
 *
 * An oversized value is treated as missing too: the string store refuses such
 * writes, and a preference file edited outside the host must not turn into a
 * multi-megabyte parse on the UI thread.
 */
export function decodeExtensionStorageJson(text: string | null): unknown | null {
  if (typeof text !== "string") {
    return null;
  }
  if (new TextEncoder().encode(text).byteLength > MAX_EXTENSION_STORE_VALUE_BYTES) {
    return null;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}
