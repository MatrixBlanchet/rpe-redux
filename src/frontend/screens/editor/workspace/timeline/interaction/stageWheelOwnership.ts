/**
 * Decides which surface owns a wheel event over the editor stage.
 *
 * The stage element is shared by the preview, the timeline canvases, the curve
 * authoring surface, the free camera, and the sampling overlay. A camera surface
 * that is visible must own the gesture, even when its overlay forgets to stop
 * propagation, so the timeline never seeks while a camera is on screen. The rule
 * stays pure so the stage route and its unit test agree without a DOM.
 */

/** Flags that decide who owns a wheel event over the editor stage. */
export interface StageWheelOwnerFlags {
  /** The standalone free-camera mode is active. */
  readonly freeCamera: boolean;
  /** The curve trajectory surface is open in draw or equation mode. */
  readonly curvePreview: boolean;
  /** A live sampling session is attached to the stage. */
  readonly sampling: boolean;
  /** A listener already consumed the event before it reached the stage route. */
  readonly defaultPrevented: boolean;
}

/**
 * Return `"camera"` when a camera surface owns the wheel, `"timeline"` otherwise.
 *
 * Any active camera surface wins over the timeline, as does an event that a
 * listener already prevented. Only a plain stage gesture with no camera surface
 * falls through to timeline navigation.
 */
export function stageWheelAction(flags: StageWheelOwnerFlags): "camera" | "timeline" {
  return flags.freeCamera || flags.curvePreview || flags.sampling || flags.defaultPrevented
    ? "camera"
    : "timeline";
}
