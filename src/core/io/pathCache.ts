/**
 * Bounded cache for normalized and resolved filesystem paths.
 *
 * Asset lookup normalizes the same names on every frame and document open. A
 * bounded cache keeps that work off the interaction path without holding an
 * unbounded set of historical paths. Entries are case-folded by the shared
 * normalizer, matching how chart resources compare across hosts.
 */
import { normalizePath } from "../utils/paths.ts";

/** Default number of normalized paths retained. */
const DEFAULT_PATH_CACHE_LIMIT = 1024;

/** LRU cache for path normalization and caller-defined resolved paths. */
export class PathCache {
  private readonly limit: number;
  private readonly normalized = new Map<string, string>();
  private readonly resolved = new Map<string, string>();

  /** Create a cache; `limit` applies to each of the normalized and resolved maps. */
  constructor(limit = DEFAULT_PATH_CACHE_LIMIT) {
    this.limit = Number.isFinite(limit) ? Math.max(1, Math.floor(limit)) : DEFAULT_PATH_CACHE_LIMIT;
  }

  /** Number of normalized paths currently retained. */
  get size(): number {
    return this.normalized.size;
  }

  /** Normalize a path, reusing the cached value when this exact string was seen. */
  normalize(path: string): string {
    const cached = this.normalized.get(path);
    if (cached !== undefined) {
      this.touch(this.normalized, path, cached);
      return cached;
    }
    const value = normalizePath(path);
    this.touch(this.normalized, path, value);
    return value;
  }

  /** Read a caller-defined resolved value, refreshing its recency. */
  get(key: string): string | undefined {
    const value = this.resolved.get(key);
    if (value !== undefined) {
      this.touch(this.resolved, key, value);
    }
    return value;
  }

  /** Store a resolved value, evicting the least recently used entry when full. */
  set(key: string, value: string): void {
    this.touch(this.resolved, key, value);
  }

  /** Drop every cached path; used when a document or asset map is replaced. */
  clear(): void {
    this.normalized.clear();
    this.resolved.clear();
  }

  /** Insert or refresh one entry and evict the oldest when the map is full. */
  private touch(cache: Map<string, string>, key: string, value: string): void {
    if (cache.has(key)) {
      cache.delete(key);
    }
    cache.set(key, value);
    while (cache.size > this.limit) {
      const oldest = cache.keys().next().value;
      if (oldest === undefined) {
        return;
      }
      cache.delete(oldest);
    }
  }
}

/** Shared normalization cache used by resource lookup and document keys. */
export const sharedPathCache = new PathCache();

/** Normalize through the shared cache. */
export function cachedNormalizePath(path: string): string {
  return sharedPathCache.normalize(path);
}
