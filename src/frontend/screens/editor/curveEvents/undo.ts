/**
 * Routes the draft's undo/redo keys before the chart's own history.
 *
 * While the curve overlay is active, Ctrl+Z and Ctrl+Y walk the draw draft and
 * consume the event so one press never undoes both the stroke and a chart edit.
 */
import { curvePreviewMode } from "./mode.ts";
import { isTextTarget } from "./overlayModel.ts";
import { curvePreviewState, redoCurveEdit, undoCurveEdit } from "./store.ts";

/** Whether the draw draft consumes the event as an undo or redo. */
export function claimCurveDraftShortcut(event: KeyboardEvent): boolean {
  if (!curvePreviewMode.get() || event.isComposing || event.altKey) {
    return false;
  }
  if (isTextTarget(event.target) || curvePreviewState.get().editMode !== "draw") {
    return false;
  }
  if (!(event.ctrlKey || event.metaKey)) {
    return false;
  }
  const key = event.key.toLowerCase();
  if (key === "z") {
    return event.shiftKey ? redoCurveEdit() : undoCurveEdit();
  }
  if (key === "y") {
    return redoCurveEdit();
  }
  return false;
}
