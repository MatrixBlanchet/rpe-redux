/**
 * Deterministic fingerprints for cached canonical text.
 *
 * `fingerprintText` hashes raw text and `fingerprintJsonText` hashes its canonical
 * JSON form, so callers can detect a changed snapshot without keeping a copy.
 */
/** Return a small deterministic fingerprint for canonical text snapshots. */
export function fingerprintText(text: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/** Fingerprint JSON without making object insertion order part of document identity. */
export function fingerprintJsonText(text: string): string {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return fingerprintText(text);
  }

  let marker = "\u0000rpe-fingerprint-negative-zero\u0000";
  const ordinary = JSON.stringify(value);
  while (ordinary.includes(JSON.stringify(marker))) {
    marker += "#";
  }
  const canonical = JSON.stringify(
    value,
    (_key, entry) => {
      if (Object.is(entry, -0)) {
        return marker;
      }
      if (entry && typeof entry === "object" && !Array.isArray(entry)) {
        return Object.fromEntries(
          Object.keys(entry)
            .sort()
            .map((key) => [key, (entry as Record<string, unknown>)[key]]),
        );
      }
      return entry;
    },
    2,
  ).replaceAll(JSON.stringify(marker), "-0");
  return fingerprintText(canonical);
}
