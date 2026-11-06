/**
 * The home library's presentation mode.
 *
 * It belongs to the user rather than to a chart, so it survives reopening the
 * app and lives in the welcome preference section beside the other home-screen
 * choices.
 */
import { PREFERENCE_SECTIONS, preferences } from "../../../core/state/preferences.ts";

/** How the chart library arranges its entries. */
export type LibraryView = "list" | "grid";

/** Reads the stored view mode, defaulting to the list. */
function normalize(value: unknown): LibraryView {
  if (!value || typeof value !== "object") {
    return "list";
  }
  return (value as { libraryView?: unknown }).libraryView === "grid" ? "grid" : "list";
}

/** Returns the persisted library view mode. */
export function getLibraryView(): LibraryView {
  return normalize(preferences.read(PREFERENCE_SECTIONS.welcome, null));
}

/** Persists the view mode beside the other welcome preferences. */
export function setLibraryView(view: LibraryView): void {
  const current = preferences.read<unknown>(PREFERENCE_SECTIONS.welcome, null);
  const record = current && typeof current === "object" ? (current as Record<string, unknown>) : {};
  preferences.write(PREFERENCE_SECTIONS.welcome, { ...record, libraryView: view });
}
