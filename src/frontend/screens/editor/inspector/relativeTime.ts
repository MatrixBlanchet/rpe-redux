/**
 * Relative time formatting shared by inspector history surfaces.
 *
 * Callers inject the current time so one panel clock drives every row. Text is
 * cached per language, timestamp, and granularity: seconds while the age is
 * below one minute, minutes afterwards. The cache stays bounded so a live clock
 * cannot accumulate keys for every row and second.
 */

const relativeTimeFormatters = new Map<string, Intl.RelativeTimeFormat>();
const relativeTimeCache = new Map<string, { bucket: number; text: string }>();
const RELATIVE_TIME_CACHE_LIMIT = 256;

/** Returns the document language key, falling back when no DOM exists. */
function relativeTimeLanguage(): string {
  return typeof document === "undefined" ? "default" : document.documentElement.lang || "default";
}

/** Returns the cached formatter for the document language. */
function relativeTimeFormatter(language: string): Intl.RelativeTimeFormat {
  let formatter = relativeTimeFormatters.get(language);
  if (!formatter) {
    formatter = new Intl.RelativeTimeFormat(language === "default" ? undefined : language, {
      numeric: "auto",
    });
    relativeTimeFormatters.set(language, formatter);
  }
  return formatter;
}

/** Stores one text and evicts the oldest entries beyond the cache limit. */
function cacheRelativeTime(key: string, bucket: number, text: string): void {
  relativeTimeCache.delete(key);
  relativeTimeCache.set(key, { bucket, text });
  while (relativeTimeCache.size > RELATIVE_TIME_CACHE_LIMIT) {
    const oldest = relativeTimeCache.keys().next().value;
    if (oldest === undefined) {
      break;
    }
    relativeTimeCache.delete(oldest);
  }
}

/**
 * Localized relative time for one timestamp at the supplied clock reading.
 *
 * `now` is explicit so callers and tests can drive the same reading through
 * every row. Within one second or one minute the bucket start determines the
 * text, keeping repeated calls stable until the bucket advances.
 */
export function relativeTime(timestamp: number, now: number = Date.now()): string {
  const language = relativeTimeLanguage();
  const secondsFromNow = (timestamp - now) / 1000;
  const absoluteFromNow = Math.abs(secondsFromNow);
  const secondGranularity = absoluteFromNow < 60;
  const unit = secondGranularity ? "second" : "minute";
  const bucketSize = secondGranularity ? 1_000 : 60_000;
  const bucket = Math.floor(now / bucketSize);
  const cacheKey = `${language}:${unit}:${timestamp}`;
  const cached = relativeTimeCache.get(cacheKey);
  if (cached?.bucket === bucket) {
    return cached.text;
  }
  const seconds = (timestamp - bucket * bucketSize) / 1000;
  const [value, relativeUnit] = secondGranularity
    ? [seconds, "second"]
    : absoluteFromNow < 3600
      ? [seconds / 60, "minute"]
      : absoluteFromNow < 86400
        ? [seconds / 3600, "hour"]
        : [seconds / 86400, "day"];
  const text = relativeTimeFormatter(language).format(
    Math.round(value),
    relativeUnit as Intl.RelativeTimeFormatUnit,
  );
  cacheRelativeTime(cacheKey, bucket, text);
  return text;
}

/** Test-only cache access; not part of the product contract. */
export const __testInternals = {
  cacheSize: () => relativeTimeCache.size,
  clearCache: () => relativeTimeCache.clear(),
  maxEntries: RELATIVE_TIME_CACHE_LIMIT,
};

if (typeof window !== "undefined") {
  const warm = () => {
    try {
      relativeTimeFormatter(relativeTimeLanguage()).format(0, "second");
    } catch {}
  };
  if (typeof requestIdleCallback === "function") {
    requestIdleCallback(warm, { timeout: 1_000 });
  } else {
    setTimeout(warm, 0);
  }
}
