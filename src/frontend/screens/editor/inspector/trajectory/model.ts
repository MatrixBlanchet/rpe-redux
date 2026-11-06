/**
 * Snapshot cell for the trajectory pane, created once per mounted editor tree.
 *
 * The snapshot carries the view component, its props, and a revision that
 * remounts the form when drafts must not survive.
 */
import { createValue, type ValueCell } from "../../../../../core/state/values.ts";
import type { ComponentType } from "react";
import type { TrajectoryPanelViewProps } from "./TrajectoryPanelView.tsx";

/** One published form revision and the props it mounts with. */
export interface TrajectoryPanelSnapshot {
  component: ComponentType<TrajectoryPanelViewProps>;
  props: TrajectoryPanelViewProps;
  revision: number;
}

export type TrajectoryPanelState = ValueCell<TrajectoryPanelSnapshot | null>;

/** Creates trajectory inspector state for one mounted editor tree. */
export function createTrajectoryPanelState(): TrajectoryPanelState {
  return createValue<TrajectoryPanelSnapshot | null>({ initial: null });
}
