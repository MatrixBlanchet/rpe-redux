/** Descriptive metadata shared by chart creation and inline editing. */
import type { Chart } from "../../../../core/global/chart/chart.ts";
import type { MessageKey } from "../../../../i18n/index.ts";

/** Editable description fields, in display order. `label` is an i18n key. */
export const metadataFields = [
  { key: "name", label: "editorPanels.inspector.form.field.name" },
  { key: "composer", label: "editorPanels.inspector.form.field.composer" },
  { key: "charter", label: "editorPanels.inspector.form.field.charter" },
  { key: "illustration", label: "editorPanels.inspector.form.field.illustration" },
  { key: "level", label: "editorPanels.inspector.form.field.level" },
] as const satisfies readonly { key: string; label: MessageKey }[];

/** The editable metadata field names. */
export type MetadataField = (typeof metadataFields)[number]["key"];
/** One string value per metadata field. */
export type MetadataValues = Record<MetadataField, string>;

/** Extract the editable metadata values from a chart, using empty strings for absent fields. */
export function metadataValues(chart?: Chart): MetadataValues {
  return {
    name: String(chart?.META.name ?? ""),
    composer: String(chart?.META.composer ?? ""),
    charter: String(chart?.META.charter ?? ""),
    illustration: String(chart?.META.illustration ?? ""),
    level: String(chart?.META.level ?? ""),
  };
}

/** Whether every metadata field has non-whitespace text. */
export function completeMetadata(values: MetadataValues): boolean {
  return metadataFields.every(({ key }) => Boolean(values[key].trim()));
}
