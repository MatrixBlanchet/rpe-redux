/**
 * Shared open state for the home screen's import dialog.
 *
 * The header menu, the first-run RPE choice, and the dialog itself all use this
 * one request path so there is never a second import surface with different
 * copy or behaviour.
 */
import { createValue } from "../../../core/state/values.ts";

const dialog = createValue<boolean>({ initial: false });

/** Whether the import dialog is open. */
export const getWelcomeImportDialog = dialog.get;
/** Subscribe to the dialog's open state. */
export const subscribeWelcomeImportDialog = dialog.subscribe;

/** Open the import dialog from any home-screen entry point. */
export function openWelcomeImportDialog(): void {
  dialog.set(true);
}

/** Close the import dialog and return the home screen to its normal state. */
export function closeWelcomeImportDialog(): void {
  dialog.set(false);
}
