/**
 * The one-time question shown before a new chart is created.
 *
 * The remembered answers are written by the document service; this module only
 * presents the four choices as one footer action row and resolves the answer.
 * Dismissing the dialog cancels the creation, so dismissing never silently
 * writes a preference.
 */
import { createElement } from "react";
import { Button } from "../../../../../../design/components/button/Button.tsx";
import { dismissModal, presentModal } from "../../../../../overlays/modals/modalQueue.ts";
import { t } from "../../../../../../i18n/index.ts";
import type { NewChartDetectionChoice } from "./newChartDetectionPreference.ts";
import { NEW_CHART_DETECTION_ACTIONS } from "./newChartDetectionActions.ts";

let nextId = 0;

/** Ask how this chart and future charts should handle timing detection. */
export function requestNewChartDetectionChoice(): Promise<NewChartDetectionChoice | null> {
  return new Promise((resolve) => {
    const id = `new-chart-detection:${++nextId}`;
    let pending = true;
    const settle = (choice: NewChartDetectionChoice | null): void => {
      if (!pending) {
        return;
      }
      pending = false;
      dismissModal(id);
      resolve(choice);
    };
    presentModal(id, {
      label: t("editorPanels.timingDetection.newChart.title"),
      description: t("editorPanels.timingDetection.newChart.description"),
      className: "redux-prompt-dialog redux-new-chart-detection",
      onClose: () => settle(null),
      actions: NEW_CHART_DETECTION_ACTIONS.map((action) =>
        createElement(
          Button,
          {
            key: action.key,
            variant: action.variant,
            onClick: () => settle(action.key),
          },
          t(action.labelKey),
        ),
      ),
    });
  });
}
