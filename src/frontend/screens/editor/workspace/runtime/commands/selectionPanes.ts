/**
 * Applies a selection-pane decision by calling the configured inspector effects
 * in their required order. The decision itself is made by the selection router.
 */
import type { JudgeLineEvent } from "../../../../../../core/global/chart/chart.ts";
import type { SelectionPaneAction } from "../bridge/selectionPaneRouting.ts";

/** Inspector operations a selection-pane decision can invoke. */
export interface SelectionPaneEffects {
  syncMulti(): void;
  activatePane(name: string): void;
  openMulti(focus: "notes" | "events"): void;
  deactivateCurve(): void;
  openTrajectory(event: JudgeLineEvent, lineIndex: number, layer: number): void;
  closePane(): void;
}

/** Applies the selection router's decision while preserving editor side-effect order. */
export function applySelectionPaneAction(
  action: SelectionPaneAction,
  effects: SelectionPaneEffects,
): void {
  switch (action.kind) {
    case "sync-multi":
      effects.syncMulti();
      break;
    case "activate-trajectory":
      effects.activatePane("trajectory");
      break;
    case "activate-curve":
      effects.activatePane("curve");
      break;
    case "open-multi":
      effects.activatePane("multi");
      effects.openMulti(action.focus);
      break;
    case "open-trajectory":
      effects.deactivateCurve();
      effects.openTrajectory(action.event, action.lineIndex, action.layer);
      break;
    case "activate-pane":
      effects.activatePane(action.name);
      break;
    case "close":
      effects.closePane();
      break;
    case "none":
      break;
  }
}
