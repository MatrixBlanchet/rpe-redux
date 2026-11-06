/**
 * Pure selection and deletion rules for the curve draft.
 *
 * A selected segment is the deletion target; otherwise the whole selected path
 * is removed. With no selection Delete does nothing.
 */
import { deleteSegments, type CurvePathComponent, type SegmentTarget } from "./pathModel.ts";

/** The draw draft's current path and segment selection. */
export interface CurveSelectionState {
  selectedId: string | null;
  selectedSegment: SegmentTarget | null;
}

/** The resulting paths, selection, and what Delete removed. */
export interface CurveDeleteResult extends CurveSelectionState {
  components: CurvePathComponent[];
  removed: "segment" | "path" | null;
}

/** Resolve one Delete press against the current selection. */
export function deleteCurveSelection(
  components: readonly CurvePathComponent[],
  selectedId: string | null,
  selectedSegment: SegmentTarget | null,
): CurveDeleteResult {
  if (selectedSegment) {
    const component = components.find((entry) => entry.id === selectedSegment.componentId);
    if (!component || !component.segments[selectedSegment.segmentIndex]) {
      return {
        components: [...components],
        selectedId,
        selectedSegment: null,
        removed: null,
      };
    }
    const next = deleteSegments(components, [selectedSegment]);
    // A cut keeps the first surviving run's id, so the selected path stays
    // selected; clearing the whole path falls back to the first remaining path.
    const keepsSelection = next.some((entry) => entry.id === selectedSegment.componentId);
    return {
      components: next,
      selectedId: keepsSelection ? selectedSegment.componentId : (next[0]?.id ?? null),
      selectedSegment: null,
      removed: "segment",
    };
  }
  if (selectedId) {
    return {
      components: components.filter((entry) => entry.id !== selectedId),
      selectedId: null,
      selectedSegment: null,
      removed: "path",
    };
  }
  return {
    components: [...components],
    selectedId: null,
    selectedSegment: null,
    removed: null,
  };
}
