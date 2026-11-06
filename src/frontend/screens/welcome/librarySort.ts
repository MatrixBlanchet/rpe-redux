/**
 * The home library's sort field and direction.
 *
 * Sorting belongs to the user rather than to a chart, so it survives reopening
 * the app beside the other welcome-screen preferences.
 */
import type {
  LibrarySortDirection,
  LibrarySortField,
} from "../../../core/global/library/client.ts";
import { PREFERENCE_SECTIONS, preferences } from "../../../core/state/preferences.ts";

/** The field and direction the sidecar uses for the home library listing. */
export interface LibrarySort {
  field: LibrarySortField;
  direction: LibrarySortDirection;
}

const FIELDS: readonly LibrarySortField[] = ["updated", "created", "name", "composer", "charter"];

/** Text fields read naturally A–Z; timestamps read newest first. */
export function defaultLibraryDirection(field: LibrarySortField): LibrarySortDirection {
  return field === "updated" || field === "created" ? "desc" : "asc";
}

/** Narrows a stored value to a known sort field, defaulting to `updated`. */
function fieldOf(value: unknown): LibrarySortField {
  return FIELDS.includes(value as LibrarySortField) ? (value as LibrarySortField) : "updated";
}

/** Reads the welcome preference record, or an empty object. */
function welcomeRecord(): Record<string, unknown> {
  const value = preferences.read<unknown>(PREFERENCE_SECTIONS.welcome, null);
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

/** Read the persisted sort, falling back to the modified timestamp. */
export function getLibrarySort(): LibrarySort {
  const record = welcomeRecord();
  const field = fieldOf(record.librarySort);
  const direction =
    record.librarySortDirection === "asc" || record.librarySortDirection === "desc"
      ? record.librarySortDirection
      : defaultLibraryDirection(field);
  return { field, direction };
}

/** Persist the selected sort beside the other home-screen preferences. */
export function setLibrarySort(sort: LibrarySort): void {
  preferences.write(PREFERENCE_SECTIONS.welcome, {
    ...welcomeRecord(),
    librarySort: sort.field,
    librarySortDirection: sort.direction,
  });
}
