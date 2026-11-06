/**
 * Shared state for the pointer-position overlap picker.
 *
 * The picker lists the objects under one pointer position. Its rows are drawn
 * by the shared context-menu renderer without inheriting right-click commands.
 */
import {
  createContextMenuState,
  type ContextMenuAnchor,
} from "../contextMenu/ContextMenuPopup.tsx";

/** One layer choice offered by the overlap picker. */
export interface OverlapMenuAction {
  id: string;
  label: string;
  detail?: string;
  run(): void;
}

/** Snapshot of the open overlap picker: pointer anchor, heading, and choices. */
export interface OverlapMenuSnapshot extends ContextMenuAnchor {
  title: string;
  actions: readonly OverlapMenuAction[];
}

export const overlapMenu = createContextMenuState<OverlapMenuSnapshot>();

/** Open the layer-style picker at a pointer position. */
export function openOverlapMenu(
  owner: HTMLElement | null,
  x: number,
  y: number,
  title: string,
  actions: readonly OverlapMenuAction[],
): void {
  // Defer by one task so the click that follows pointer-up does not dismiss the
  // newly opened popover as an outside click.
  setTimeout(() => overlapMenu.set({ owner, x, y, title, actions }), 0);
}
