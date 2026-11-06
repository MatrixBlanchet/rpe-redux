/**
 * Open the settings dialog from anywhere in the shell.
 *
 * The window owns its own `open` flag, so this only has to carry the category
 * with it — no React state has to be threaded through the shell.
 */
/** Window event a caller dispatches to open the dialog, optionally on a category. */
export const OPEN_SETTINGS_EVENT = "redux-open-settings";
/** Window event a caller dispatches to close the dialog. */
export const CLOSE_SETTINGS_EVENT = "redux-close-settings";

/** Ask the mounted settings window to open, optionally on a category key. */
export function openSettings(category?: string): void {
  window.dispatchEvent(new CustomEvent(OPEN_SETTINGS_EVENT, { detail: { category } }));
}

/** Ask the mounted settings window to close. */
export function closeSettings(): void {
  window.dispatchEvent(new Event(CLOSE_SETTINGS_EVENT));
}
