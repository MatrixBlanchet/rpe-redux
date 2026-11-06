/**
 * The bottom status bar.
 *
 * It shows the always-open chart-info readouts at the leading edge; the
 * trailing edge stays free. Chart readouts are published by
 * `chartInfoPresenter.ts`, so the bar only lays them out.
 */
import { useSyncExternalStore } from "react";
import { ChartInfoView } from "./ChartInfoView.tsx";
import { getChartInfoRows, subscribeChartInfoRows } from "./chartInfoPresenter.ts";

/** Bottom status bar showing chart-info rows; modes may hide it. */
export function StatusBar({ hidden = false }: { hidden?: boolean }) {
  const chartInfoRows = useSyncExternalStore(
    subscribeChartInfoRows,
    getChartInfoRows,
    getChartInfoRows,
  );

  return (
    <footer hidden={hidden}>
      <div id="chart-info" className="chart-info">
        <ChartInfoView rows={chartInfoRows} />
      </div>
    </footer>
  );
}
