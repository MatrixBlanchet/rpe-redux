/**
 * Presentation rules for the home library's detail column.
 *
 * The column is permanent: it shows the selected chart when that selection is
 * still in the current list, and the explicit prompt otherwise. Keeping it
 * mounted through loading, empty, and failed reads gives the library one stable
 * width instead of collapsing to a single column after the first read.
 */
import type { LibraryEntry } from "./libraryEntries.ts";

/** Which surface the detail column should show for the current library. */
export type LibraryDetailState = "prompt" | "detail";

/**
 * Resolves a selection key against the current list.
 *
 * A null key or a stale key resolves to null: selection never falls back to
 * the first chart, because an implied selection would make the detail pane look
 * like loaded content the user never chose.
 */
export function resolveLibrarySelection(
  entries: readonly LibraryEntry[],
  selectedKey: string | null,
): LibraryEntry | null {
  if (selectedKey === null) {
    return null;
  }
  return entries.find((entry) => entry.key === selectedKey) ?? null;
}

/**
 * The permanent detail column prompts until a current entry is selected.
 *
 * The column never hides, including for an empty library, so the page keeps
 * its two-column frame from the first paint through every read phase.
 */
export function libraryDetailState(
  entries: readonly LibraryEntry[],
  selected: LibraryEntry | null,
): LibraryDetailState {
  return selected !== null && entries.some((entry) => entry.key === selected.key)
    ? "detail"
    : "prompt";
}

/** A real entry is the only object export, delete, and open may act on. */
export function canOperateOnLibraryEntry(entry: LibraryEntry | null): entry is LibraryEntry {
  return entry !== null;
}
