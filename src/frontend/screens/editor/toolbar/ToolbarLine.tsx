/**
 * Lays out one editor toolbar row from its registered entries.
 *
 * The shared `ToolbarRow` owns entry filtering, merged-flow cleanup, and the
 * row container. This wrapper contributes only the editor's node set, which
 * adds fields to the actions, controls, dividers, and spacers the default rows
 * draw.
 */
import type { CSSProperties, ReactNode } from "react";
import { Divider } from "../../../../design/components/divider/Divider.tsx";
import type { ToolbarEntry, ToolbarRowName } from "../../../../core/shell/registries/toolbar.ts";
import { toolbarActionNode } from "../../../chrome/toolbar/ToolbarAction.tsx";
import { ToolbarRow, type ToolbarRowFlow } from "../../../chrome/toolbar/ToolbarRow.tsx";
import { toolbarFieldNode } from "./ToolbarFields.tsx";
import { toolbarControlNode } from "./ToolbarControls.tsx";

/** Render one registered entry as the node its kind names. */
function editorItemNode(entry: ToolbarEntry, tRaw: (key: string) => string): ReactNode {
  switch (entry.kind) {
    case "control":
      return toolbarControlNode(entry);
    case "divider":
      return <Divider />;
    case "field":
      return toolbarFieldNode(entry, tRaw);
    case "spacer": {
      const style =
        entry.cells === undefined ? undefined : ({ "--slot-cells": entry.cells } as CSSProperties);
      return <span className="redux-toolbar-slot" style={style} aria-hidden="true" />;
    }
    default:
      return toolbarActionNode(entry, tRaw);
  }
}

/**
 * One row of the toolbar: whatever the registry put in it, in `order`.
 *
 * Items are drawn flat — a rule or a gap appears because something asked for one
 * in this row, never because two neighbours happened to differ.
 */
export function ToolbarLine({
  row,
  entries,
  flow = "rows",
}: {
  /** Omitted when the theme asks for one continuous line or a grid. */
  row?: ToolbarRowName;
  entries: readonly ToolbarEntry[];
  flow?: ToolbarRowFlow;
}) {
  return <ToolbarRow row={row} entries={entries} flow={flow} renderEntry={editorItemNode} />;
}
