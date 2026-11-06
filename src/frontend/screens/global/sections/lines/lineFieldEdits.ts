/**
 * Pure batch edits for the judge-line property form.
 *
 * The form owns one set of controls for the current selection, so a batch edit
 * must update every selected line without applying the other (possibly mixed)
 * controls. Each helper takes the field that actually changed and returns a new
 * chart; the panel controller owns the commit and history label.
 */
import type { Chart, JudgeLine } from "../../../../../core/global/chart/chart.ts";
import { groupNames } from "../../../../../core/global/chart/line/lineGroups.ts";
import { setLineParent } from "../../../../../core/global/chart/line/lineEdits.ts";
import { t } from "../../../../../i18n/index.ts";

/** Judge-line properties the panel form can edit. */
export type LineField =
  | "name"
  | "group"
  | "isCover"
  | "zOrder"
  | "bpmfactor"
  | "anchorX"
  | "anchorY"
  | "attachUI"
  | "parent"
  | "rotateWithFather";

/** One editable judge-line property and the form value supplying it. */
export interface LineFieldEdit {
  field: LineField;
  /** The form value; empty is meaningful only for optional fields. */
  value: string;
  /** Checkbox state; only `rotateWithFather` reads it. */
  checked?: boolean;
}

/** The fields that cannot be collapsed onto a multi-line selection. */
const PER_LINE_FIELDS = new Set<LineField>(["name", "parent", "rotateWithFather"]);

/** Deduplicated, in-range indices for an edit. */
function validTargets(chart: Chart, indices: readonly number[]): number[] {
  const lines = chart.judgeLineList ?? [];
  return [...new Set(indices)].filter(
    (index) => Number.isInteger(index) && index >= 0 && index < lines.length,
  );
}

/**
 * Parses a numeric form value; a blank value is allowed only for a multi-line
 * edit, where it means "leave each line's value unchanged".
 */
function numberValue(raw: string, multiple: boolean, message: string): number | null {
  if (raw === "" && multiple) {
    return null;
  }
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    throw new Error(message);
  }
  return value;
}

/**
 * Apply one changed form field to the selected lines.
 *
 * `name`, `parent`, and `rotateWithFather` stay per line: they are relational or
 * identifying values, not a shared visual property. A multi-line request for one
 * of them is rejected instead of guessing which line should keep its own value.
 */
export function editLineField(
  chart: Chart,
  indices: readonly number[],
  edit: LineFieldEdit,
): Chart {
  const targets = validTargets(chart, indices);
  if (!targets.length) {
    return chart;
  }
  const multiple = targets.length > 1;
  if (multiple && PER_LINE_FIELDS.has(edit.field)) {
    throw new Error(t("editorPanels.linePanel.batchUnsupported"));
  }
  if (edit.field === "parent") {
    // An empty field is the explicit "no parent" state; numbers name a line.
    const raw = edit.value.trim();
    const parent = raw === "" ? -1 : Number(raw);
    const current = Number(chart.judgeLineList?.[targets[0]]?.father ?? -1);
    return current === parent ? chart : setLineParent(chart, targets[0], parent);
  }

  const sourceLines = chart.judgeLineList ?? [];
  const lines = [...sourceLines];
  let changed = false;
  /** Maps a line through the one field that changed. */
  const update = (line: JudgeLine): JudgeLine => {
    switch (edit.field) {
      case "name":
        return { ...line, Name: edit.value };
      case "group": {
        const group = Number(edit.value);
        if (!Number.isInteger(group) || group < 0 || group >= groupNames(chart).length) {
          throw new Error(t("editorPanels.linePanel.invalidGroup"));
        }
        return { ...line, Group: group };
      }
      case "isCover":
        return { ...line, isCover: Number(edit.value) === 1 ? 1 : 0 };
      case "zOrder": {
        const value = numberValue(edit.value, multiple, t("editorPanels.linePanel.invalidZOrder"));
        return value === null ? line : { ...line, zOrder: Math.trunc(value) };
      }
      case "bpmfactor": {
        const value = numberValue(edit.value, multiple, t("editorPanels.linePanel.invalidZOrder"));
        if (value === null) {
          return line;
        }
        if (value <= 0) {
          throw new Error(t("editorPanels.linePanel.invalidZOrder"));
        }
        return { ...line, bpmfactor: value };
      }
      case "anchorX": {
        const value = numberValue(edit.value, multiple, t("editorPanels.linePanel.invalidAnchor"));
        if (value === null) {
          return line;
        }
        const anchor = Array.isArray(line.anchor) ? [...line.anchor] : [0.5, 0.5];
        anchor[0] = value;
        return { ...line, anchor };
      }
      case "anchorY": {
        const value = numberValue(edit.value, multiple, t("editorPanels.linePanel.invalidAnchor"));
        if (value === null) {
          return line;
        }
        const anchor = Array.isArray(line.anchor) ? [...line.anchor] : [0.5, 0.5];
        anchor[1] = value;
        return { ...line, anchor };
      }
      case "attachUI":
        return { ...line, attachUI: edit.value || undefined };
      case "rotateWithFather":
        return { ...line, rotateWithFather: Boolean(edit.checked) };
      default:
        return line;
    }
  };

  for (const index of targets) {
    const line = update(lines[index]);
    if (line !== lines[index]) {
      lines[index] = line;
      changed = true;
    }
  }
  return changed ? { ...chart, judgeLineList: lines } : chart;
}
