/**
 * The active theme's declarative UI contribution.
 *
 * `applyTheme` publishes the validated tree here after it paints the document;
 * React hosts read the snapshot instead of parsing package documents.
 */
import { createValue } from "../state/values.ts";
import { EMPTY_THEME_UI, type ThemeUi } from "./ui.ts";

const ui = createValue<ThemeUi>({ initial: EMPTY_THEME_UI });

/** The UI contribution currently applied to the document. */
export const getThemeUi = ui.get;
/** Subscribe to UI contribution changes; returns the unsubscribe callback. */
export const subscribeThemeUi = ui.subscribe;
/** Publish a validated UI contribution after it has been applied. */
export function setThemeUi(next: ThemeUi): void {
  ui.set(next);
}
