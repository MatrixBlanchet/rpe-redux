/**
 * Chart-info rows for the status bar.
 *
 * The rows arrive as ready-to-render items; this component only lays them out.
 */
/** One labelled cell inside a status-bar row. */
export interface ChartInfoItem {
  key: string;
  text: string;
}

/** A status-bar row made of labelled cells. */
export interface ChartInfoRow {
  items: ChartInfoItem[];
}

/** Renders published chart-info rows without inspecting their contents. */
export function ChartInfoView({ rows }: { rows: ChartInfoRow[] }) {
  return rows.map((row) => (
    <div className="chart-info-row" key={row.items.map((item) => item.key).join(":")}>
      {row.items.map((item) => (
        <span className="chart-info-item" key={item.key}>
          {item.text}
        </span>
      ))}
    </div>
  ));
}
