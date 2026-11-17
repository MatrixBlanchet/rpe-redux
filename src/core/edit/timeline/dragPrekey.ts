/**
 * RPE's drag prekey: holding Z turns a pointer drag on a Hold or an event bar
 * into a head/tail edge edit instead of a move or a selection.
 *
 * The keyboard dispatcher owns the held-key set; timeline interaction reads it
 * at pointer-down so the modifier is sampled once per gesture.
 */
import { heldShortcutKeys } from "../../shortcuts/inputKeys.ts";

/** Whether the drag prekey is held for the pointer gesture starting now. */
export function dragPrekeyHeld(): boolean {
  return heldShortcutKeys().has("Z");
}
