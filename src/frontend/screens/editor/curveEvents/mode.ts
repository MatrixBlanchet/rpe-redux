/**
 * Visibility cell for the non-modal curve preview editor.
 *
 * The curve-preview Inspector panel owns the mode: while it is active, the
 * overlay becomes visible. The stage, renderer, and overlay all read this cell
 * so the sidebar is the only mode owner.
 */
import { createValue } from "../../../../core/state/values.ts";

/** Whether the curve preview surface is active. */
export const curvePreviewMode = createValue<boolean>({ initial: false });

/** Leave curve preview mode; the inspector panel clears its own active state. */
export function closeCurvePreviewMode(): void {
  curvePreviewMode.set(false);
}
