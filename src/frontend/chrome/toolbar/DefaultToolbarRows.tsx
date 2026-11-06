/**
 * The default toolbar rows for a surface that contributes commands only.
 *
 * Fields and controls are editor surfaces; a surface that needs them supplies
 * its own `toolbarRows` component in its `WorkspaceSurfaceDefinition`. The
 * editor supplies one, so this fallback renders shared actions, dividers, and
 * spacers through the shared row container.
 */
import type { CSSProperties, ReactNode } from "react";
import { Divider } from "../../../design/components/divider/Divider.tsx";
import type { ToolbarEntry } from "../../../core/shell/registries/toolbar.ts";
import { transportControlNode } from "../transport/TransportControls.tsx";
import { toolbarActionNode } from "./ToolbarAction.tsx";
import { ToolbarRow, type ToolbarRowFlow } from "./ToolbarRow.tsx";

/** Builds the node for one entry: an action button, transport control, divider, or slot. */
function defaultItemNode(entry: ToolbarEntry, tRaw: (key: string) => string): ReactNode {
  switch (entry.kind) {
    case "action":
      return toolbarActionNode(entry, tRaw);
    case "control":
      return transportControlNode(entry);
    case "divider":
      return <Divider />;
    case "spacer": {
      const style =
        entry.cells === undefined ? undefined : ({ "--slot-cells": entry.cells } as CSSProperties);
      return <span className="redux-toolbar-slot" style={style} aria-hidden="true" />;
    }
    default:
      return null;
  }
}

/** Renders the shared rows for a mode without editor-only controls. */
export function DefaultToolbarRows({
  entries,
  flow = "rows",
}: {
  entries: readonly ToolbarEntry[];
  flow?: ToolbarRowFlow;
}) {
  if (flow === "single" || flow === "grid") {
    return <ToolbarRow entries={entries} flow={flow} renderEntry={defaultItemNode} />;
  }

  return (
    <>
      <ToolbarRow row={1} entries={entries} renderEntry={defaultItemNode} />
      <ToolbarRow row={2} entries={entries} renderEntry={defaultItemNode} />
    </>
  );
}
