/**
 * Collects the stage's overlay controllers into the per-editor UI state object.
 * Each overlay owns its own cells; this module only composes them.
 */
import { createLineInfoState } from "../lineInfo/lineInfoController.ts";
import { createTrajectoryOverlayVisibility } from "../trajectoryOverlay/trajectoryOverlay.ts";
import { createBatchControlsState } from "../batchControls/batchControls.ts";

/** State cells owned by the stage and its overlays. */
export function createStageUiState() {
  return {
    lineInfo: createLineInfoState(),
    trajectoryOverlay: createTrajectoryOverlayVisibility(),
    batchControls: createBatchControlsState(),
  };
}

/** The stage UI state assembled from its overlay controllers. */
export type StageUiState = ReturnType<typeof createStageUiState>;
