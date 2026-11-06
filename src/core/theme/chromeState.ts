/**
 * The active chrome recipe as observable state.
 *
 * `applyTheme` writes the validated recipe here after it paints the document;
 * React hosts read it through `frontend/app/useThemeChrome.ts`. Keeping the
 * snapshot in core means a host never has to parse `data-chrome-*` attributes
 * or listen to the raw DOM event.
 */
import { createValue } from "../state/values.ts";
import { DEFAULT_THEME_CHROME, type ThemeChrome } from "./packages.ts";

const chrome = createValue<ThemeChrome>({ initial: DEFAULT_THEME_CHROME });

/** The recipe currently applied to the document. */
export const getThemeChrome = chrome.get;
/** Subscribe to recipe changes; returns the unsubscribe callback. */
export const subscribeThemeChrome = chrome.subscribe;
/** Publish a validated recipe after it has been applied. */
export function setThemeChrome(next: ThemeChrome): void {
  chrome.set(next);
}
