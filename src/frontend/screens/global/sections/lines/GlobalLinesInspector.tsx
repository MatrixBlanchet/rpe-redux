/** Judge-line property inspector for the drawer. */
import { LinesPanel } from "./LinesPanel.tsx";

/** Renders the judge-line property inspector for the selected line. */
export function GlobalLinesInspector() {
  return <LinesPanel showTitle={false} variant="properties" />;
}
