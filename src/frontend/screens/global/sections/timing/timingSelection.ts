/**
 * The timing point selected on the global timing page.
 *
 * The workspace owns the list and the inspector owns the attributes for this
 * one index, mirroring the two-pane timing screen rather than duplicating the
 * BPM list inside the inspector.
 */
import { createValue } from "../../../../../core/state/values.ts";

/** Index of the timing point selected on the global timing page. */
export const timingPointSelection = createValue<number>({ initial: 0 });

/** Which timing target the right inspector is showing. */
export type TimingInspectorTarget = "point" | "offset";

/** Inspector face for the selected timing point or for the chart offset. */
export const timingInspectorTarget = createValue<TimingInspectorTarget>({ initial: "point" });

/** Keep the selection inside a list that just shrank or grew. */
export function clampTimingSelection(count: number): number {
  const index = Math.max(0, Math.min(timingPointSelection.get(), Math.max(0, count - 1)));
  if (index !== timingPointSelection.get()) {
    timingPointSelection.set(index);
  }
  return index;
}
