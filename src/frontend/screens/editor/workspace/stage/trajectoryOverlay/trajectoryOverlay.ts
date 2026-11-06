/**
 * Visibility cell for the inspector-owned trajectory overlay. The inspector
 * draws the canvas; the stage only decides whether it is shown.
 */
import { createValue, type ValueCell } from "../../../../../../core/state/values.ts";

/** Whether the trajectory overlay canvas is shown. */
export type TrajectoryOverlayVisibility = ValueCell<boolean>;

/** Creates the visibility cell shared by the runtime and the trajectory overlay. */
export function createTrajectoryOverlayVisibility(): TrajectoryOverlayVisibility {
  return createValue({ initial: false });
}
