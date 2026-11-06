/**
 * Late-bound open action for the trajectory pane.
 *
 * Opening it deactivates an active curve capture first, and the binding clears
 * on unmount so a stale closure is never called.
 */
import { deactivateCurve } from "../curveNotes/actions.ts";
let open: (() => void) | null = null;

/** Binds the mounted opener; the returned callback unbinds it. */
export function bindTrajectoryAction(current: () => void): () => void {
  open = current;
  return () => {
    if (open === current) {
      open = null;
    }
  };
}
/** Opens the trajectory pane after ending any curve anchor pick. */
export function openTrajectory(): void {
  if (open) {
    deactivateCurve();
    open();
  }
}
