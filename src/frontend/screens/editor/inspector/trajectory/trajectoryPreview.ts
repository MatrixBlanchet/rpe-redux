/**
 * Builds the trajectory preview with the same replace decision Apply will use.
 *
 * A preview that always replaced would show a clean path while a non-replace
 * commit rejects the occupied range. This helper probes the range first and
 * marks the preview as non-committable; the panel then disables Apply and shows
 * the reason while still drawing the intended path.
 */
import { beatValue } from "../../../../../core/global/chart/timing/beat.ts";
import type {
  Chart,
  JudgeLineEvent,
  LineEventLayer,
} from "../../../../../core/global/chart/chart.ts";
import { trajectoryChart } from "../../../../../core/edit/events/trajectoryCommands.ts";
import { TRAJECTORY_AXES } from "../../../../../core/global/chart/trajectory/expandTrajectory.ts";
import { trajectoryHasRotation } from "../../../../../core/global/chart/trajectory/curveTrajectory.ts";

/** The chart to preview plus whether the current replace flag can be committed. */
export interface TrajectoryPreview {
  chart: Chart;
  /** True when the range is occupied while replace is off. */
  occupied: boolean;
}

/** A layer whose track map accepts a runtime-computed track name. */
type TrackedLayer = LineEventLayer & { [track: string]: JudgeLineEvent[] | undefined };

/**
 * Whether a non-replace write would overlap an existing event on a track that
 * the generated trajectory writes. The edited event never blocks itself.
 */
export function trajectoryRangeOccupied(
  chart: Chart,
  lineIndex: number,
  layerIndex: number,
  event: JudgeLineEvent,
  editing: JudgeLineEvent | null = null,
): boolean {
  const layer = chart.judgeLineList?.[lineIndex]?.eventLayers?.[layerIndex] as
    TrackedLayer | undefined;
  if (!layer) {
    return false;
  }
  const begin = beatValue(event.startTime);
  const finish = beatValue(event.endTime);
  const writesRotation = trajectoryHasRotation(event.trajectory?.options);
  return Object.keys(TRAJECTORY_AXES).some((track) => {
    if (track === "rotateEvents" && !writesRotation) {
      return false;
    }
    return (layer[track] ?? []).some(
      (candidate) =>
        candidate !== editing &&
        beatValue(candidate.startTime) < finish &&
        beatValue(candidate.endTime) > begin,
    );
  });
}

/**
 * Build the live preview exactly as Apply would, apart from a display-only
 * fallback when a non-replace range is occupied.
 *
 * On that fallback the returned chart replaces the range only so the curve
 * remains visible; `occupied` is true and the caller must disable Apply.
 */
export function buildTrajectoryPreview(
  chart: Chart,
  lineIndex: number,
  layerIndex: number,
  event: JudgeLineEvent,
  editing: JudgeLineEvent | null = null,
  replace = false,
): TrajectoryPreview {
  if (!replace && trajectoryRangeOccupied(chart, lineIndex, layerIndex, event, editing)) {
    return {
      chart: trajectoryChart(chart, lineIndex, layerIndex, event, editing, true),
      occupied: true,
    };
  }
  return {
    chart: trajectoryChart(chart, lineIndex, layerIndex, event, editing, replace),
    occupied: false,
  };
}
