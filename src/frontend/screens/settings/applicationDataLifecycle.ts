/** Decides which application-data image reference became unreachable after a setting write. */

/** Return the previous reference when a setting replaced or cleared it. */
export function replacedApplicationDataReference(previous: unknown, next: unknown): string | null {
  const oldReference = typeof previous === "string" ? previous.trim() : "";
  const nextReference = typeof next === "string" ? next.trim() : "";
  return oldReference && oldReference !== nextReference ? oldReference : null;
}
