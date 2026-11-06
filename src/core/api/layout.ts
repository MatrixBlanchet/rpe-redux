/** Owns the frozen facade for read-only host layout anchors. */
import { getLayoutApi } from "../edit/layout/api.ts";
import type { LayoutAnchor } from "../edit/layout/api.ts";
import { type ApiAvailability, type ApiResult } from "./contract.ts";
import { availabilityFor, errorResult, frozenRect, unavailableResult } from "./support.ts";

/** Freeze one anchor and its client rectangle. */
function frozenAnchor(anchor: LayoutAnchor): LayoutAnchor {
  return Object.freeze({
    id: anchor.id,
    kind: anchor.kind,
    label: anchor.label,
    client: frozenRect(anchor.client),
  });
}

/** Host layout anchors exposed to plugins. */
export const layout = Object.freeze({
  /** Report whether a layout runtime is connected. */
  availability(): ApiAvailability {
    return availabilityFor(getLayoutApi(), "No layout runtime connected");
  },

  /**
   * Read the current visible host regions and form controls.
   *
   * Only geometry and host labels are exposed; input values and DOM nodes never
   * cross this boundary.
   */
  anchors(): ApiResult<readonly LayoutAnchor[]> {
    const api = getLayoutApi();
    if (!api) {
      return unavailableResult<readonly LayoutAnchor[]>("No layout runtime connected");
    }
    try {
      return { ok: true, value: Object.freeze(api.anchors().map(frozenAnchor)) };
    } catch (error) {
      return errorResult(error);
    }
  },
});

export type {
  LayoutAnchor,
  LayoutAnchorKind,
  LayoutRect,
  LayoutSnapshot,
} from "../edit/layout/api.ts";
