/**
 * State for the curve inspector, created once per mounted editor tree.
 *
 * A single snapshot carries the form values, the parse error, and the preview
 * flag, so the pane renders from one read.
 */
import { createValue, type ValueCell } from "../../../../../core/state/values.ts";
import type { CurveFieldLabels, CurveFieldValues } from "./CurveFieldsView.tsx";

/** Everything the curve form renders in one snapshot. */
export interface CurveFieldSnapshot {
  labels: CurveFieldLabels;
  values: CurveFieldValues;
  /** The failed parse message, or `null` while the draft is valid. */
  error: string | null;
  /** Whether the generated notes are drawn in the editing area as a ghost. */
  preview: boolean;
  onInput(values: CurveFieldValues): void;
  onPreviewChange(preview: boolean): void;
}

/** The curve form's initial values, shared by the editor and its reset actions. */
export const DEFAULT_CURVE_FIELD_VALUES: CurveFieldValues = {
  startTime: [0, 0, 1],
  endTime: [4, 0, 1],
  startX: -405,
  endX: 405,
  density: 1,
  type: 4,
  easingType: 1,
};

export type CurvePickMode = "start" | "end" | null;
export interface CurveState {
  fields: ValueCell<CurveFieldSnapshot | null>;
  pickMode: ValueCell<CurvePickMode>;
}

/** Creates curve inspector state for one mounted editor tree. */
export function createCurveState(): CurveState {
  return {
    fields: createValue<CurveFieldSnapshot | null>({ initial: null }),
    pickMode: createValue<CurvePickMode>({ initial: null }),
  };
}
