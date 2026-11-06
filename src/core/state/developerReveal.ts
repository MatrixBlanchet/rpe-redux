/**
 * The persisted flag behind the help page's reveal gesture.
 *
 * It records whether developer tools are shown, while the desktop host still
 * decides which of them are available. The value lives in core state so the
 * settings page, the shortcut editor, and the chrome action registry read the
 * same preference without importing one another.
 */
import { defineValue } from "./values.ts";
import { PREFERENCE_SECTIONS } from "./preferences.ts";

/** Persisted value key for the reveal preference. */
const REVEAL_ID = "settings.developer-visible";

/**
 * Whether the help page shows its developer tools.
 *
 * This is a reveal preference, not a developer capability: the desktop host
 * still decides whether DevTools and inspection are available. The flag lives in
 * the settings section so it survives a restart like any other preference.
 */
export const developerReveal = defineValue<boolean>({
  id: REVEAL_ID,
  initial: false,
  persist: PREFERENCE_SECTIONS.settings,
});

/** The current reveal state, read without subscribing. */
export const isDeveloperRevealed = (): boolean => developerReveal.get();

/** Toggle the revealed section; returns the state it now has. */
export function toggleDeveloperReveal(): boolean {
  const next = !isDeveloperRevealed();
  developerReveal.set(next);
  return next;
}
