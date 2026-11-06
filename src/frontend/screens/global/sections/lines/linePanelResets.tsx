/**
 * Reset affordances for the judge-line property rows.
 *
 * Line properties are stored chart data, not application preferences. This
 * compatibility seam therefore returns no reset controls; the panel still
 * owns the callbacks for ordinary edits and texture selection.
 */
import type { LineField } from "./lineFieldEdits.ts";

/** Keep the line panel's field API while omitting chart-data reset affordances. */
export function createLineResets(
  _onResetField: (field: LineField, indices?: readonly number[]) => void,
  _onSetTexture: (name: string, indices?: readonly number[]) => void,
  _indices: readonly number[] | undefined,
) {
  return {
    field: (_field: LineField, _label: string, _dirty: boolean) => undefined,
    texture: (_dirty: boolean) => undefined,
  };
}
