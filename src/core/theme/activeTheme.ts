/**
 * The active interface theme as one shared preference.
 *
 * The shell paints the document from this value, and the settings window writes
 * it through the same preference section, so both surfaces stay in sync without
 * a second in-memory copy.
 */
import { PREFERENCE_SECTIONS, preferences } from "../state/preferences.ts";
import { DEFAULT_THEME, type Theme } from "./themes.ts";

/** The stored theme, or the built-in default when the preference is absent. */
export function activeTheme(): Theme {
  const stored = preferences.read(PREFERENCE_SECTIONS.appearance, DEFAULT_THEME);
  return typeof stored === "string" ? (stored as Theme) : DEFAULT_THEME;
}

/** Subscribe to theme preference changes. */
export function subscribeActiveTheme(listener: () => void): () => void {
  return preferences.subscribe(PREFERENCE_SECTIONS.appearance, listener);
}

/** Persist a theme choice; the shell applies it from the resulting change. */
export function setActiveTheme(theme: Theme): void {
  preferences.write(PREFERENCE_SECTIONS.appearance, theme);
}
