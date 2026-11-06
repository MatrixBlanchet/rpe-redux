/**
 * The editor toolbar rows.
 *
 * The editor owns the control and field renderers; the shared toolbar host
 * passes the registered entries through without a mode filter.
 */
import type { ToolbarEntry } from "../../../../core/shell/registries/toolbar.ts";
import { ToolbarLine } from "./ToolbarLine.tsx";

/**
 * Draws the editor toolbar from the registered entries.
 *
 * `rows` preserves the registered row split; `single` keeps the same entries in
 * registration order but lets the theme treat the bar as one continuous line.
 */
export function EditorToolbarRows({
  entries,
  flow = "rows",
}: {
  entries: readonly ToolbarEntry[];
  flow?: "rows" | "single" | "grid";
}) {
  if (flow === "single" || flow === "grid") {
    return <ToolbarLine entries={entries} flow={flow} />;
  }
  return (
    <>
      <ToolbarLine row={1} entries={entries} />
      <ToolbarLine row={2} entries={entries} />
    </>
  );
}
