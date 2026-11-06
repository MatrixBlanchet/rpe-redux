/**
 * Persistent run records for parameterized extension scripts.
 *
 * Like undo history, the list is a JSON string in the settings preference
 * section. The records intentionally keep ids and values only; labels belong
 * to the current extension catalog and must not make old runs language-bound.
 */
import { defineValue } from "../state/values.ts";
import { PREFERENCE_SECTIONS } from "../state/preferences.ts";

const LIMIT = 100;
const MAX_TEXT_LENGTH = 4096;

/** How a script run finished. */
export type ScriptRunStatus = "committed" | "unchanged" | "failed";

/** One stored run, kept free of localized labels. */
export interface ScriptRunEntry {
  readonly at: number;
  readonly owner: string;
  readonly scriptId: string;
  readonly params: Readonly<Record<string, JsonValue>>;
  readonly affectedCount: number;
  readonly status: ScriptRunStatus;
}

type JsonValue =
  null | boolean | number | string | readonly JsonValue[] | { readonly [key: string]: JsonValue };

const history = defineValue<string>({
  id: "script-run-history",
  initial: "[]",
  persist: PREFERENCE_SECTIONS.settings,
  validate(value) {
    if (typeof value !== "string" || !Array.isArray(JSON.parse(value))) {
      throw new Error("Script run history must be a JSON array");
    }
  },
});

/** Convert one value to JSON-safe data, dropping cycles and truncating long text. */
function jsonValue(value: unknown, seen: WeakSet<object>): JsonValue | undefined {
  if (value === null || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    return value.slice(0, MAX_TEXT_LENGTH);
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value !== "object") {
    return undefined;
  }
  if (seen.has(value)) {
    return undefined;
  }
  seen.add(value);
  try {
    if (Array.isArray(value)) {
      return value
        .map((entry) => jsonValue(entry, seen))
        .filter((entry): entry is JsonValue => entry !== undefined);
    }
    return Object.fromEntries(
      Object.entries(value)
        .map(([key, entry]) => [key, jsonValue(entry, seen)] as const)
        .filter((entry): entry is readonly [string, JsonValue] => entry[1] !== undefined),
    );
  } finally {
    seen.delete(value);
  }
}

/** Freeze run parameters after removing values that cannot be persisted. */
function sanitizeParams(
  value: Readonly<Record<string, unknown>>,
): Readonly<Record<string, JsonValue>> {
  return Object.freeze(
    Object.fromEntries(
      Object.entries(value)
        .map(([key, entry]) => [key, jsonValue(entry, new WeakSet<object>())] as const)
        .filter((entry): entry is readonly [string, JsonValue] => entry[1] !== undefined),
    ),
  );
}

function isStatus(value: unknown): value is ScriptRunStatus {
  return value === "committed" || value === "unchanged" || value === "failed";
}

/** Parse stored JSON, dropping malformed entries and keeping the newest limit. */
function decode(stored: string): readonly ScriptRunEntry[] {
  try {
    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return Object.freeze(
      parsed
        .flatMap((value): ScriptRunEntry[] => {
          if (!value || typeof value !== "object" || Array.isArray(value)) {
            return [];
          }
          const entry = value as Record<string, unknown>;
          if (
            typeof entry.at !== "number" ||
            !Number.isFinite(entry.at) ||
            typeof entry.owner !== "string" ||
            typeof entry.scriptId !== "string" ||
            !entry.params ||
            typeof entry.params !== "object" ||
            Array.isArray(entry.params) ||
            typeof entry.affectedCount !== "number" ||
            !Number.isFinite(entry.affectedCount) ||
            entry.affectedCount < 0 ||
            !isStatus(entry.status)
          ) {
            return [];
          }
          const params = sanitizeParams(entry.params as Record<string, unknown>);
          return [
            Object.freeze({
              at: entry.at,
              owner: entry.owner,
              scriptId: entry.scriptId,
              params,
              affectedCount: Math.floor(entry.affectedCount),
              status: entry.status,
            }),
          ];
        })
        .slice(0, LIMIT),
    );
  } catch {
    return [];
  }
}

let cached: readonly ScriptRunEntry[] = decode(history.get());
let cachedFrom = history.get();

/** Decode only when the stored string changed since the last read. */
function current(): readonly ScriptRunEntry[] {
  const stored = history.get();
  if (stored !== cachedFrom) {
    cached = decode(stored);
    cachedFrom = stored;
  }
  return cached;
}

/** Return newest-first records; the snapshot changes only when storage changes. */
export function scriptRunEntries(): readonly ScriptRunEntry[] {
  return current();
}

/** Return unique owner/script ids, newest use first, for panel ranking. */
export function recentScriptIds(): readonly string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const entry of current()) {
    const id = `${entry.owner}:${entry.scriptId}`;
    if (!seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  }
  return Object.freeze(ids);
}

/** Append a run without allowing persistence failures to affect script execution. */
export function appendScriptRun(entry: {
  readonly at?: number;
  readonly owner: string;
  readonly scriptId: string;
  readonly params: Readonly<Record<string, unknown>>;
  readonly affectedCount: number;
  readonly status: ScriptRunStatus;
}): boolean {
  try {
    const next: ScriptRunEntry = Object.freeze({
      at: entry.at ?? Date.now(),
      owner: entry.owner,
      scriptId: entry.scriptId,
      params: sanitizeParams(entry.params),
      affectedCount: Math.max(0, Math.floor(entry.affectedCount)),
      status: entry.status,
    });
    history.set(JSON.stringify([next, ...current()].slice(0, LIMIT)));
    return true;
  } catch {
    return false;
  }
}

/** Observe changes so consumers can re-rank without polling. */
export function subscribeScriptRunHistory(listener: () => void): () => void {
  return history.subscribeKey(listener);
}
