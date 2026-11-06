/**
 * Snapshot cell for the judge-line pane, created once per mounted editor tree.
 *
 * The revision lets the host remount the form instead of reconciling props that
 * describe a different line.
 */
import { createValue, type ValueCell } from "../../../../../core/state/values.ts";
import type { LinePanelProps } from "./LinePanel.tsx";

/** One published line-panel snapshot; the revision remounts the uncontrolled form. */
export interface LinePanelSnapshot {
  revision: number;
  props: LinePanelProps;
}

/** Published line-panel state; `null` while no snapshot exists. */
export type LinePanelState = ValueCell<LinePanelSnapshot | null>;

/** Creates line inspector state for one mounted editor tree. */
export function createLinePanelState(): LinePanelState {
  return createValue<LinePanelSnapshot | null>({ initial: null });
}
