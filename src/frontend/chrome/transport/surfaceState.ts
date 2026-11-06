/**
 * The state cells owned by the progress toolbar.
 *
 * Progress and timeline-marker state are created together so the transport surface
 * can hand them to the runtime and the views once.
 */
import { createTimelineMarkersState } from "./timelineMarkersState.ts";
import { createProgressState } from "./chartProgressState.ts";

/** State cells owned by the progress toolbar and its timeline markers. */
export function createProgressUiState() {
  return {
    timelineMarkers: createTimelineMarkersState(),
    progress: createProgressState(),
  };
}

export type ProgressUiState = ReturnType<typeof createProgressUiState>;
