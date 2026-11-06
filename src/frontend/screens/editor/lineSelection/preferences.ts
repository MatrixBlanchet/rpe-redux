/**
 * Persisted preferences for the judge-line selector.
 *
 * Folder disclosure belongs to the user, not to a chart: it survives reopening
 * the picker, switching documents and restarting the app. Selection itself is
 * never persisted; it belongs to the open document.
 */
import { useSyncExternalStore } from "react";
import { PREFERENCE_SECTIONS, preferences } from "../../../../core/state/preferences.ts";

export interface LineSelectionPreferences {
  readonly collapsedFolders: readonly string[];
}

const DEFAULT: LineSelectionPreferences = Object.freeze({
  collapsedFolders: Object.freeze([]),
});

/** Coerce a stored section value into valid, de-duplicated preferences. */
function normalize(value: unknown): LineSelectionPreferences {
  if (!value || typeof value !== "object") {
    return DEFAULT;
  }
  const record = value as { collapsedFolders?: unknown };
  const collapsed = Array.isArray(record.collapsedFolders)
    ? record.collapsedFolders.filter((entry): entry is string => typeof entry === "string")
    : [];
  return { collapsedFolders: Object.freeze([...new Set(collapsed)]) };
}

/** Whether two preference snapshots carry the same collapsed folders. */
function same(left: LineSelectionPreferences, right: LineSelectionPreferences): boolean {
  return (
    left.collapsedFolders.length === right.collapsedFolders.length &&
    left.collapsedFolders.every((folder, index) => folder === right.collapsedFolders[index])
  );
}

let snapshot = normalize(preferences.read(PREFERENCE_SECTIONS.lineSelection, null));
const listeners = new Set<() => void>();

/** Re-read the section and notify listeners when the snapshot changed. */
function publish(): void {
  const next = normalize(preferences.read(PREFERENCE_SECTIONS.lineSelection, null));
  if (same(snapshot, next)) {
    return;
  }
  snapshot = next;
  for (const listener of [...listeners]) {
    listener();
  }
}

preferences.subscribe(PREFERENCE_SECTIONS.lineSelection, publish);

/** Persist one preferences snapshot and publish it to subscribers. */
function update(next: LineSelectionPreferences): void {
  preferences.write<LineSelectionPreferences>(PREFERENCE_SECTIONS.lineSelection, next);
  publish();
}

/** The current line-selector preferences snapshot. */
export function getLineSelectionPreferences(): LineSelectionPreferences {
  return snapshot;
}

/** Subscribe to preference changes; returns an unsubscribe callback. */
export function subscribeLineSelectionPreferences(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Replace the persisted set of collapsed folder names. */
export function setLineSelectionCollapsedFolders(folders: Iterable<string>): void {
  update({ collapsedFolders: Object.freeze([...new Set(folders)].sort()) });
}

/** React binding for the line-selector preferences. */
export function useLineSelectionPreferences(): LineSelectionPreferences {
  return useSyncExternalStore(
    subscribeLineSelectionPreferences,
    getLineSelectionPreferences,
    getLineSelectionPreferences,
  );
}
