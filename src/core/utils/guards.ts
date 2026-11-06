/**
 * Checks whether an arbitrary value read from storage has a requested shape.
 */

/** Only a non-null, non-array object can carry named fields. */
export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
