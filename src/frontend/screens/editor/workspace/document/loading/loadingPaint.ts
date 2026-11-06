/**
 * Yields to the browser between load steps so progress can paint during a long
 * chart open. The loading sequence owns its stages; this module supplies only
 * the paint handshake.
 */
import { installLoadingHost } from "../../../../../../core/global/document/loading.ts";

/**
 * Lets the browser paint between load steps.
 *
 * A frame followed by a macrotask: the frame hands the compositor the new
 * progress value, and the timeout yields past the rest of the frame so a chart
 * with hundreds of thousands of objects still animates while it loads.
 */
export function installLoadingPaint(): () => void {
  return installLoadingHost({
    paint: () =>
      typeof requestAnimationFrame === "function"
        ? new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)))
        : Promise.resolve(),
  });
}
