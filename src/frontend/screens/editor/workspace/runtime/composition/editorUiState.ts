/** Composes per-mounted-editor UI state from the owning feature surfaces. */
import { createInspectorUiState } from "../../../inspector/surfaceState.ts";
import { createProgressUiState } from "../../../../../chrome/transport/surfaceState.ts";
import { createStageUiState } from "../../stage/surface/state.ts";
import { createTimelineUiState } from "../../timeline/surface/state.ts";

/** Builds the flat state object every editor adapter and surface reads. */
export function createEditorUiState() {
  const inspector = createInspectorUiState();
  const stage = createStageUiState();
  const timeline = createTimelineUiState();
  const progress = createProgressUiState();

  // Each feature factory owns its cells; the editor exposes them as one shape.
  return Object.freeze({ ...inspector, ...stage, ...timeline, ...progress });
}

/** The flat UI state shared by the editor's adapters and surfaces. */
export type EditorUiState = ReturnType<typeof createEditorUiState>;
