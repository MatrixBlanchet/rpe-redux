/**
 * The toolbar frame.
 *
 * The shared host filters registered entries by the authoring surface and hands
 * them to its `toolbarRows` renderer. The transport host stays in this stable
 * position and lets the theme choose whether the card is docked or floating.
 */
import { useRef, useState, useSyncExternalStore, type ComponentType } from "react";
import { toolbar, type ToolbarEntry } from "../../../core/shell/registries/toolbar.ts";
import { values } from "../../../core/state/values.ts";
import { useThemeChrome } from "../../app/useThemeChrome.ts";
import { TransportHost } from "../transport/TransportHost.tsx";
import { DefaultToolbarRows } from "./DefaultToolbarRows.tsx";
import { ToolbarScrollControls } from "./ToolbarScrollControls.tsx";
import type { ToolbarOverflowState } from "./toolbarOverflow.ts";

/** The surface's own toolbar rows; omitted falls back to the shared action rows. */
type ToolbarRows = ComponentType<{
  entries: readonly ToolbarEntry[];
  flow?: "rows" | "single" | "grid";
}>;

/**
 * The toolbar frame.
 *
 * Rows come from the registry, so a feature or plugin adds to them by
 * registering rather than by editing this file. Commands that live in a menu
 * draw no toolbar node.
 */
export function Toolbar({
  hidden = false,
  rows: SurfaceToolbarRows,
}: {
  hidden?: boolean;
  /** The active surface's toolbar rows; omitted uses the default action rows. */
  rows?: ToolbarRows;
}) {
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [toolbarOverflow, setToolbarOverflow] = useState<ToolbarOverflowState>({
    isNarrow: false,
    canScrollStart: false,
    canScrollEnd: false,
  });
  const chrome = useThemeChrome();
  const entries = useSyncExternalStore(toolbar.subscribe, toolbar.getSnapshot);
  useSyncExternalStore(values.byId.subscribeAll, values.getVersion);
  const order = chrome.layout.toolbarOrder;
  const ordered =
    order.length === 0
      ? entries
      : entries
          .map((entry, index) => ({ entry, index }))
          .sort((left, right) => {
            const leftOrder = order.indexOf(left.entry.id);
            const rightOrder = order.indexOf(right.entry.id);
            if (leftOrder === -1 && rightOrder === -1) {
              return left.index - right.index;
            }
            if (leftOrder === -1) {
              return 1;
            }
            if (rightOrder === -1) {
              return -1;
            }
            return leftOrder - rightOrder;
          })
          .map(({ entry }) => entry);
  const row1 = ordered.some((entry) => entry.row === 1);
  const row2 = ordered.some((entry) => entry.row === 2);
  const rows = Number(row1) + Number(row2);
  const flow = chrome.layout.toolbarFlow;
  const ToolbarRows = SurfaceToolbarRows ?? DefaultToolbarRows;
  return (
    <div
      ref={toolbarRef}
      className="redux-toolbar"
      role="toolbar"
      hidden={hidden || rows === 0}
      data-rows={rows}
      data-toolbar-flow={flow}
      data-toolbar-columns={chrome.layout.toolbarColumns}
      data-toolbar-narrow={toolbarOverflow.isNarrow ? "true" : "false"}
      data-toolbar-scroll-start={toolbarOverflow.canScrollStart ? "true" : "false"}
      data-toolbar-scroll-end={toolbarOverflow.canScrollEnd ? "true" : "false"}
    >
      <div className="redux-toolrows">
        <ToolbarRows entries={ordered} flow={flow} />
      </div>
      <ToolbarScrollControls toolbarRef={toolbarRef} onStateChange={setToolbarOverflow} />
      <TransportHost />
    </div>
  );
}
