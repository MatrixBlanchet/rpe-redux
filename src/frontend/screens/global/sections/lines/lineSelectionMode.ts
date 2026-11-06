/**
 * Writes and one invariant for the shared judge-line selection.
 *
 * The editor has one selection mode at a time: one or more line indices, or one
 * folder. A non-empty `editor.lineSelection` always leaves folder mode, whatever
 * surface wrote it, and selecting a folder always clears the line selection.
 * Keeping the one-way rule in a subscription makes folder mode imply an empty
 * line selection without every writer repeating half of the rule.
 */
import { values } from "../../../../../core/state/values.ts";

const EMPTY_SELECTION: readonly number[] = Object.freeze([]);
const LINE_SELECTION = "editor.lineSelection";
const FOLDER_GROUP = "editor.lineFolderGroup";

let unsubscribe: (() => void) | null = null;

/** Installs the rule once; safe to call from every surface that writes a mode. */
export function bindLineSelectionInvariant(): void {
  if (unsubscribe !== null) {
    return;
  }
  unsubscribe = values.byId.subscribe(LINE_SELECTION, () => {
    const selection = values.byId.get<readonly number[]>(LINE_SELECTION);
    if (selection.length && values.byId.get<number | null>(FOLDER_GROUP) !== null) {
      values.byId.set<number | null>(FOLDER_GROUP, null);
    }
  });
  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      unsubscribe?.();
      unsubscribe = null;
    });
  }
}

/** Replaces the shared line selection; a non-empty set leaves folder mode. */
export function setSelectedLineIndices(indices: readonly number[]): void {
  bindLineSelectionInvariant();
  values.byId.set<readonly number[]>(LINE_SELECTION, indices);
}

/** Selects one folder, or leaves folder mode when `group` is null. */
export function setSelectedLineFolder(group: number | null): void {
  bindLineSelectionInvariant();
  if (group === null) {
    values.byId.set<number | null>(FOLDER_GROUP, null);
    return;
  }
  values.byId.set<number | null>(FOLDER_GROUP, group);
  values.byId.set<readonly number[]>(LINE_SELECTION, EMPTY_SELECTION);
}
