/**
 * Creates the reactive state cells shared by timeline canvases, overlays, audio
 * analysis, multi-line scrolling, line switching, layer buttons, and the context menu.
 *
 * This is the timeline UI state composition root, not a behavior module.
 */
import { createAudioAnalysisVisibility } from "../audioAnalysis/audioAnalysis.ts";
import { createTimelineBindingsState } from "./timelineBindings.ts";
import { createTimelineThumbnailState } from "../overview/timelineThumbnail.ts";
import { createMultiLineScrollState } from "../multiLine/multiLineScrollBinding.ts";
import { createLineSwitcherViewState } from "../lineSwitcher/lineSwitcherBindings.ts";
import { createLayerButtonsState } from "../layers/layerButtons.ts";
import { createTimelineMenuState } from "../contextMenu/timelineMenuState.ts";

/** State cells shared by timeline canvases, overlays, and timeline adapters. */
export function createTimelineUiState() {
  return {
    audioAnalysis: createAudioAnalysisVisibility(),
    timelineBindings: createTimelineBindingsState(),
    timelineThumbnail: createTimelineThumbnailState(),
    multiLineScroll: createMultiLineScrollState(),
    lineSwitcher: createLineSwitcherViewState(),
    layerButtons: createLayerButtonsState(),
    timelineMenu: createTimelineMenuState(),
  };
}

export type TimelineUiState = ReturnType<typeof createTimelineUiState>;
