/**
 * Which marker dialog the progress card is showing.
 *
 * The progress card's menu, the jump surface, and the marker manager are
 * separate React surfaces. One small store lets the menu open either dialog
 * without the menu importing the dialog that it opens.
 */
import { createValue } from "../../../core/state/values.ts";

/** One dialog the progress card can open. */
export type MarkerDialogKind = "jump" | "manager";

const dialog = createValue<MarkerDialogKind | null>({ initial: null });

/** Subscribe to the open-dialog changes. */
export const subscribeMarkerDialog = dialog.subscribe;

/** Read the open dialog, or `null` when the progress card is idle. */
export const getMarkerDialog = dialog.get;

/** Open one marker dialog, replacing whatever the store held before. */
export function openMarkerDialog(kind: MarkerDialogKind): void {
  dialog.set(kind);
}

/** Close the open marker dialog. */
export function closeMarkerDialog(): void {
  dialog.set(null);
}
