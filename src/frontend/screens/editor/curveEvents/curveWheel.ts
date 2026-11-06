/**
 * Pure mapping from a wheel event over the curve surface to one camera zoom step.
 *
 * The overlay owns the gesture but not the camera rule: it resolves the pointer
 * against the editing canvas and hands the result to `zoomFreeCameraAt`. Keeping
 * the mapping separate lets the route be tested without a DOM.
 */
import { wheelZoomDelta } from "../workspace/stage/freeCamera/freeCamera.ts";

/** Screen-space rectangle the curve canvas occupies, in client pixels. */
export interface CurveWheelBounds {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

/** One wheel gesture over the curve surface. */
export interface CurveWheelZoomInput {
  readonly clientX: number;
  readonly clientY: number;
  readonly deltaY: number;
  /** `WheelEvent.deltaMode`; non-pixel deltas are normalized like the timeline. */
  readonly deltaMode?: number;
  readonly bounds: CurveWheelBounds;
  /** Whether the pointer is over the floating tool rail, which keeps its own scrolling. */
  readonly overToolDock: boolean;
}

/** Pointer offset from the canvas centre plus the wheel delta to apply. */
export interface CurveWheelZoom {
  readonly cursorX: number;
  readonly cursorY: number;
  readonly deltaY: number;
}

/**
 * Resolve one wheel event into a zoom step, or `null` when the gesture is not a
 * vertical zoom or belongs to the tool rail.
 */
export function curveWheelZoom(input: CurveWheelZoomInput): CurveWheelZoom | null {
  const deltaY = wheelZoomDelta(input.deltaY, input.deltaMode);
  if (deltaY === 0) {
    return null;
  }
  if (input.overToolDock) {
    return null;
  }
  const { bounds } = input;
  return {
    cursorX: input.clientX - bounds.left - bounds.width / 2,
    cursorY: input.clientY - bounds.top - bounds.height / 2,
    deltaY,
  };
}

/**
 * Apply one wheel gesture through `zoom`, returning whether it was a camera
 * gesture. The callback receives the pointer relative to the canvas centre.
 */
export function applyCurveWheelZoom(
  input: CurveWheelZoomInput,
  zoom: (cursorX: number, cursorY: number, deltaY: number) => void,
): boolean {
  const step = curveWheelZoom(input);
  if (!step) {
    return false;
  }
  zoom(step.cursorX, step.cursorY, step.deltaY);
  return true;
}
