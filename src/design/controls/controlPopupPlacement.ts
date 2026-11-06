/**
 * Shared geometry for the native-select and colour-control popups.
 *
 * Both panels anchor to a control, flip above it when the space below is too
 * small, stay inside the viewport or the open dialog, and publish the
 * `--control-origin-*` variables the panel animation reads. Sizing policy stays
 * with each caller: a select clamps its height to the remaining space, while
 * the colour panel keeps its fixed size.
 */
import type { CSSProperties } from "react";

/** Viewport-relative anchor box of the control that opened the popup. */
export interface ControlPopupAnchor {
  left: number;
  top: number;
  bottom: number;
  width: number;
}

/** Client box of the dialog that contains the control, or the viewport fallback. */
export interface ControlPopupContainer {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Geometry and placement policy for one control popup. */
export interface ControlPopupPlacementOptions {
  anchor: ControlPopupAnchor;
  panelWidth: number;
  panelHeight: number;
  /** The open dialog's client box; omit when the control lives in the viewport. */
  dialog?: ControlPopupContainer | null;
  viewport: { width: number; height: number };
  /** Clamp the visible height to the chosen side and emit `maxHeight`. */
  clampHeight?: boolean;
  /** Space required below the anchor before the panel prefers the side above. */
  flipThreshold?: number;
  /** Flip only when the space above is larger than the space below. */
  preferLargerSide?: boolean;
  /** Top inset used when measuring the space above for the flip decision. */
  flipAboveInset?: number;
}

/** Positioned style and the side the panel chose. */
export interface ControlPopupPlacement {
  style: CSSProperties;
  flipUp: boolean;
}

/** Minimum distance from a dialog or viewport edge. */
const EDGE = 6;
/** Distance between the anchor and the panel on its chosen side. */
const GAP = 3;
/** Space kept free below the anchor before a panel flips above it. */
const FLIP_GAP = 8;
/** Horizontal inset that keeps the transform origin inside the panel. */
const ORIGIN_INSET = 8;

/**
 * Place one control popup.
 *
 * The returned `style` is relative to the dialog when one is supplied and fixed
 * to the viewport otherwise. `flipUp` is exposed for callers that need the
 * chosen side for their own state; the origin variables already encode it.
 */
export function placeControlPopup({
  anchor,
  panelWidth,
  panelHeight,
  dialog = null,
  viewport,
  clampHeight = false,
  flipThreshold = panelHeight,
  preferLargerSide = false,
  flipAboveInset = FLIP_GAP,
}: ControlPopupPlacementOptions): ControlPopupPlacement {
  const containerLeft = dialog?.left ?? 0;
  const containerTop = dialog?.top ?? 0;
  const containerWidth = dialog?.width ?? viewport.width;
  const containerHeight = dialog?.height ?? viewport.height;
  const below = Math.max(0, containerTop + containerHeight - anchor.bottom - FLIP_GAP);
  const above = Math.max(0, anchor.top - containerTop - flipAboveInset);
  const flipUp =
    below < flipThreshold && (preferLargerSide ? above > below : above > flipThreshold);
  const height = clampHeight
    ? Math.max(1, Math.min(panelHeight, flipUp ? above : below))
    : panelHeight;
  const left = Math.max(
    EDGE,
    Math.min(anchor.left - containerLeft, containerWidth - panelWidth - EDGE),
  );
  const top = flipUp
    ? Math.max(EDGE, anchor.top - containerTop - height - GAP)
    : Math.min(anchor.bottom - containerTop + GAP, containerHeight - height - EDGE);
  const originX = Math.min(
    Math.max(anchor.left + anchor.width / 2 - (containerLeft + left), ORIGIN_INSET),
    panelWidth - ORIGIN_INSET,
  );
  const style = {
    position: dialog ? "absolute" : "fixed",
    left,
    top,
    width: panelWidth,
    ...(clampHeight ? { maxHeight: height } : {}),
    "--control-origin-x": `${originX}px`,
    "--control-origin-y": flipUp ? `${height}px` : "0px",
  } as CSSProperties;
  return { style, flipUp };
}
