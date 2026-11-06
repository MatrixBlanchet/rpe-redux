/**
 * Compatibility entry point for the multi-line judge-line bar model.
 *
 * The row model and click rule live in `editor/multiLine` because the inspector
 * list and the timeline bar share them; this module keeps the bar's original
 * import path working.
 */
export * from "../../../multiLine/multiLineLineBar.ts";
