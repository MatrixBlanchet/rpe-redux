/**
 * Connects the mounted editor session to the core selection interface.
 *
 * This adapter is intentionally tiny: selection policy lives in core/edit,
 * while the runtime owns which session is live after document replacement.
 * The returned disposer is the lifetime seam for that connection; selection
 * callbacks only synchronize event-placement chrome when the public snapshot
 * changes the active event context.
 */
import { connectSelectionApi } from "../../../../../../core/edit/selection/api.ts";
import type { EditorSession } from "../../../../../../core/edit/session/session.ts";
import type { Timeline } from "../../timeline/surface/timeline.ts";
import { eventTypesForLine, EXTENDED_EVENT_LAYER } from "../../timeline/drawing/tracks.ts";
import type { createSelectionClipboard } from "../../../../../../core/edit/clipboard/selectionClipboard.ts";

type SelectionTimeline = Pick<Timeline, "cancelPlacement" | "eventTypes"> & {
  gestures: Pick<Timeline["gestures"], "layer" | "extended" | "eventPlacementType">;
  cache: Pick<Timeline["cache"], "invalidateEvents">;
};

/** Connects the live editor session to the core selection interface. */
export function bindEditorSelection(
  getSession: () => EditorSession,
  timeline: SelectionTimeline,
  clipboard: ReturnType<typeof createSelectionClipboard>,
): () => void {
  return connectSelectionApi({
    session: getSession,
    clipboard,
    selectionChanged: (selection) => {
      if (selection.focus !== "events") {
        return;
      }
      const chart = getSession().chart;
      const extended = selection.events.length
        ? selection.events.every(
            ({ lineIndex, eventType }) =>
              !eventTypesForLine(chart.judgeLineList?.[lineIndex], false).includes(eventType),
          )
        : timeline.gestures.extended;
      const layer = extended ? EXTENDED_EVENT_LAYER : selection.eventLayer;
      if (timeline.gestures.layer === layer) {
        return;
      }
      timeline.cancelPlacement();
      timeline.gestures.layer = layer;
      timeline.cache.invalidateEvents();
      timeline.gestures.eventPlacementType = timeline.eventTypes[0];
    },
  });
}
