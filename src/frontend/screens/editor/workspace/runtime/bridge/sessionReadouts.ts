/**
 * Publishes chart-info, line, and history readouts for the current session.
 * The statusbar owns their presentation; this module owns the values derived
 * from the session.
 */
import type { EditorChartInfoPresenter } from "../../../../../chrome/statusbar/chartInfoPresenter.ts";
import { EditorSession } from "../../../../../../core/edit/session/session.ts";

import { publishEditorSessionSnapshots } from "./sessionSnapshots.ts";

import type { EditorEditClock } from "../../../../../../core/edit/state/editClock.ts";

type SessionChartInfo = Pick<EditorChartInfoPresenter, "render" | "updateClock" | "dispose">;
/** Values the readouts derive from the session and its edit clock. */
export interface SessionReadoutOptions {
  editClock: Pick<EditorEditClock, "format">;
  createChartInfoPresenter(): SessionChartInfo;
  renderTimelineMarkers(): void;
}
/** Own the chart-info presenter and publish document-derived readouts. */
export function createSessionReadouts(runtime: SessionReadoutOptions) {
  let chartInfo: SessionChartInfo | undefined;
  return {
    /** Renders chart info and publishes the session-derived status values. */
    publish(session: EditorSession): void {
      runtime.renderTimelineMarkers();
      chartInfo ??= runtime.createChartInfoPresenter();
      const totalLines = chartInfo.render(session, runtime.editClock.format());
      publishEditorSessionSnapshots(session, totalLines);
    },
    /** The chart-info presenter created on first publish. */
    chartInfoPresenter: () => chartInfo,
    /** Releases the chart-info presenter. */
    dispose: () => chartInfo?.dispose(),
  };
}
