/**
 * One toolbar row shared by the default chrome rows and the editor rows.
 *
 * The row owns the visible-entry filter, the merged-flow seam cleanup, the
 * container attributes, and the Fragment key. A caller supplies only the node
 * renderer, so its kind set (the editor adds fields) stays its own choice.
 */
import { Fragment, type ReactNode } from "react";
import { useTranslation } from "../../../i18n/react.ts";
import type { ToolbarEntry, ToolbarRowName } from "../../../core/shell/registries/toolbar.ts";
import { continuousEntries, visibleToolbarEntries } from "./toolbarEntries.ts";

/** How the toolbar lays rows out: registered rows, one line, or grid columns. */
export type ToolbarRowFlow = "rows" | "single" | "grid";

export interface ToolbarRowProps {
  /** Omitted for a merged single line or grid, where every registered row joins. */
  row?: ToolbarRowName;
  entries: readonly ToolbarEntry[];
  flow?: ToolbarRowFlow;
  /** Draws one entry; the row supplies the translator for runtime labels. */
  renderEntry(entry: ToolbarEntry, tRaw: (key: string) => string): ReactNode;
}

/** One toolbar row; renders nothing when no entry in the row is visible. */
export function ToolbarRow({ row, entries, flow = "rows", renderEntry }: ToolbarRowProps) {
  const { tRaw } = useTranslation();
  const rowEntries = visibleToolbarEntries(entries, row);
  const drawn = flow === "rows" ? rowEntries : continuousEntries(rowEntries);
  if (drawn.length === 0) {
    return null;
  }
  return (
    <div className="redux-toolbar-line" data-toolbar-line={row ?? "all"} data-flow={flow}>
      {drawn.map((entry) => (
        <Fragment key={entry.id}>{renderEntry(entry, tRaw)}</Fragment>
      ))}
    </div>
  );
}
