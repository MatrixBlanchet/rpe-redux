/**
 * The four answers to the new-chart timing question.
 *
 * Labels, order, and emphasis live here so the prompt and its tests share one
 * list. The remembered answers come first; the one-time answers follow, with
 * the primary "detect once" action last.
 */
import type { MessageKey } from "../../../../../../i18n/index.ts";
import type { NewChartDetectionChoice } from "./newChartDetectionPreference.ts";

/** One footer answer: the choice it resolves, its copy, and its emphasis. */
export interface NewChartDetectionAction {
  key: NewChartDetectionChoice;
  labelKey: MessageKey;
  variant: "outlined" | "solid";
}

/** The four answers in footer order. */
export const NEW_CHART_DETECTION_ACTIONS: readonly NewChartDetectionAction[] = [
  {
    key: "always",
    labelKey: "editorPanels.timingDetection.newChart.always",
    variant: "outlined",
  },
  {
    key: "never",
    labelKey: "editorPanels.timingDetection.newChart.never",
    variant: "outlined",
  },
  {
    key: "skip",
    labelKey: "editorPanels.timingDetection.newChart.skip",
    variant: "outlined",
  },
  {
    key: "once",
    labelKey: "editorPanels.timingDetection.newChart.once",
    variant: "solid",
  },
];
