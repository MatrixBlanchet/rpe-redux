/**
 * Remembers which SQLite project an imported file path came from.
 *
 * The library is the source of truth. This map lets an import refresh the same
 * project instead of creating a duplicate, and lets a library project with no
 * assets find its original file once.
 */
import {
  PREFERENCE_SECTIONS,
  preferences,
  type PreferenceSection,
} from "../../state/preferences.ts";
import { isRecord } from "../../utils/guards.ts";

/** The slice of `PreferenceStore` this mapping reads and writes. */
export interface CatalogStore {
  read(section: PreferenceSection, fallback: unknown): unknown;
  write(section: PreferenceSection, value: unknown): unknown;
}

/** Case- and separator-insensitive key for a file path. */
const normalize = (path: string): string => String(path).replaceAll("\\", "/").toLowerCase();

/** Current path-to-project mapping from the library preference section. */
function mapping(store: CatalogStore): Record<string, unknown> {
  const value = store.read(PREFERENCE_SECTIONS.library, {});
  return isRecord(value) ? value : {};
}

/** The SQLite project id recorded for a document path, if any. */
export function catalogIdFor(path: string, store: CatalogStore = preferences): string | undefined {
  const id = mapping(store)[normalize(path)];
  return typeof id === "string" ? id : undefined;
}

/** The last file path recorded for a project id, if any. */
export function catalogPathFor(id: string, store: CatalogStore = preferences): string | undefined {
  for (const [path, value] of Object.entries(mapping(store))) {
    if (value === id) {
      return path;
    }
  }
  return undefined;
}

/** Record the relationship after an import. */
export function rememberCatalogPath(
  path: string,
  id: string,
  store: CatalogStore = preferences,
): void {
  store.write(PREFERENCE_SECTIONS.library, { ...mapping(store), [normalize(path)]: id });
}

/** Drop a path mapping when the project is deleted. */
export function forgetCatalogPath(path: string, store: CatalogStore = preferences): void {
  const next = { ...mapping(store) };
  delete next[normalize(path)];
  store.write(PREFERENCE_SECTIONS.library, next);
}

/** Drop every path mapping that still points at a deleted project. */
export function forgetCatalogProject(id: string, store: CatalogStore = preferences): void {
  const next = { ...mapping(store) };
  for (const [path, value] of Object.entries(next)) {
    if (value === id) {
      delete next[path];
    }
  }
  store.write(PREFERENCE_SECTIONS.library, next);
}
