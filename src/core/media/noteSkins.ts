/**
 * The active note skin and its loading lifecycle.
 *
 * Bundled-skin resolution and change notification arrive through installed hooks,
 * so this core module never imports a bundler glob or the DOM.
 */
import type { NoteSkinManifest } from "./noteSkin.ts";
import { localService } from "../global/library/service.ts";
import {
  PREFERENCE_SECTIONS,
  preferences,
  readPreference,
  writePreference,
} from "../state/preferences.ts";

/**
 * Note skins: what one is, which one is active, and how it is loaded.
 *
 * The layer direction is the point of this module. A skin is chart-adjacent data
 * — the preview and the hit sounds both read it — so the domain lives in core.
 * Two things about it are *not* domain: resolving the skin bundled with the
 * build (a bundler and `document` concern), and announcing the change as a DOM
 * event. Those arrive through the two hooks below, which
 * `frontend/platform/noteSkinBridge.ts` installs at boot, so this file never
 * imports `@tauri-apps`, a bundler glob, or `document`.
 */

/** Supplies the skin compiled into the build. */
export type BundledNoteSkinLoader = () => Promise<LoadedNoteSkin>;

/** Supplies a skin package discovered beside the executable. */
export type ExternalNoteSkinLoader = (id: string) => Promise<LoadedNoteSkin>;

let bundledLoader: BundledNoteSkinLoader | null = null;
let externalLoader: ExternalNoteSkinLoader | null = null;
let skinChanged: (() => void) | null = null;

/** Install the loader that resolves the bundled skin, or null to clear it. */
export function setBundledNoteSkinLoader(loader: BundledNoteSkinLoader | null): void {
  bundledLoader = loader;
}

/** Install the loader that resolves an external skin by id, or null to clear it. */
export function setExternalNoteSkinLoader(loader: ExternalNoteSkinLoader | null): void {
  externalLoader = loader;
}

/** Called after the active skin is written, so the host can announce it. */
export function setNoteSkinChangeNotifier(notify: (() => void) | null): void {
  skinChanged = notify;
}

/**
 * Announce a content change to the active skin.
 *
 * Selecting a different package already writes the preference and announces
 * itself. An external package can instead replace its bitmaps on disk while
 * keeping the same id, so the host has to announce that case too.
 */
export function notifyNoteSkinChanged(): void {
  skinChanged?.();
}

/** A loaded skin and the preview textures the picker can show. */
export interface NoteSkinReady {
  id: string;
  previews: { name: string; url: string }[];
}
/** A parsed skin package: manifest plus its file bytes. */
export interface LoadedNoteSkin {
  id: string;
  manifest: NoteSkinManifest;
  files: Map<string, Uint8Array>;
}

/** Id of the skin compiled into the build. */
export const DEFAULT_NOTE_SKIN = "builtin:default";
/** Prefix for skins discovered beside the executable. */
export const EXTERNAL_NOTE_SKIN_PREFIX = "external:";

/** The selected skin id, normalized to a selectable package. */
export const activeNoteSkin = () => {
  const selected = readPreference<string>(PREFERENCE_SECTIONS.noteSkin, DEFAULT_NOTE_SKIN);
  // Compatibility ids `rpe` and `external:default` both name the bundled default.
  if (selected === "rpe" || selected === "external:default") {
    return DEFAULT_NOTE_SKIN;
  }
  // Any other id reads as the default skin.
  return selected === DEFAULT_NOTE_SKIN || selected.startsWith(EXTERNAL_NOTE_SKIN_PREFIX)
    ? selected
    : DEFAULT_NOTE_SKIN;
};

/**
 * Select a skin and persist it through the preference store.
 *
 * The live choice is committed synchronously; a changed value notifies the host
 * unless the load failed and restored the previous id.
 */
export async function selectNoteSkin(id: string) {
  // Commit the live choice synchronously: late connection results cannot reorder selections.
  const previous = readPreference<string>(PREFERENCE_SECTIONS.noteSkin, DEFAULT_NOTE_SKIN);
  writePreference(PREFERENCE_SECTIONS.noteSkin, id);
  // A failed load reverts to the last working id through this function; announcing
  // an unchanged value would make the renderer retry the load that just failed.
  if (previous !== id) {
    skinChanged?.();
  }
  if (!preferences.client) {
    const found = await localService({ refresh: true });
    if (found) {
      await preferences.attach(found.library);
    }
  }
  await preferences.ready();
  // Persist the active manifest-backed skin selection.
  return preferences.flush();
}
/**
 * Load a skin by id.
 *
 * External ids use the installed external loader; every other id loads the
 * bundled package. Throws when the required loader is not installed.
 */
export async function loadNoteSkin(id: string): Promise<LoadedNoteSkin> {
  if (id.startsWith(EXTERNAL_NOTE_SKIN_PREFIX)) {
    if (!externalLoader) {
      throw new Error(`Unsupported note skin: ${id}`);
    }
    return externalLoader(id.slice(EXTERNAL_NOTE_SKIN_PREFIX.length));
  }
  if (!bundledLoader) {
    throw new Error(`Unsupported note skin: ${id}`);
  }
  // The bundled package is the only built-in skin; any non-external id loads it.
  return bundledLoader();
}
