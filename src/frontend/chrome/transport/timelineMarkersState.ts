/** Owns the timeline-markers snapshot the runtime creates and the markers controller fills. */
import { createValue, type ValueCell } from "../../../core/state/values.ts";
import type { TimelineMarkersViewProps } from "./timelineMarkersContract.ts";

export type TimelineMarkersSnapshot = TimelineMarkersViewProps;

/** The markers snapshot and the callbacks its view invokes. */
export interface TimelineMarkersState {
  readonly snapshot: ValueCell<TimelineMarkersSnapshot | null>;
}

/** Creates the empty markers cell the runtime publishes into. */
export function createTimelineMarkersState(): TimelineMarkersState {
  return Object.freeze({
    snapshot: createValue<TimelineMarkersSnapshot | null>({ initial: null }),
  });
}
