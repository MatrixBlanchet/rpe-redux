/**
 * The batch control groups offered for notes and events, with their colours and
 * message keys. Static presentation data; gesture behavior lives in
 * `batchControls`.
 */
import type { MessageKey } from "../../../../../../i18n/index.ts";

export interface BatchControlSpec {
  kind: string;
  color: string;
  title: MessageKey;
  label?: MessageKey;
}

export const batchControlConfigurations: Record<string, BatchControlSpec[]> = {
  notes: [
    { kind: "note-move", color: "#ff0088", title: "editorPanels.batch.control.noteMove" },
    {
      kind: "note-scale",
      color: "#00aabb",
      title: "editorPanels.batch.control.noteScale",
      label: "editorPanels.batch.control.noteScaleLabel",
    },
    { kind: "note-line", color: "#b400ff", title: "editorPanels.batch.control.noteLine" },
  ],
  events: [
    {
      kind: "event-move",
      color: "#ef4545",
      title: "editorPanels.batch.control.eventMove",
      label: "editorPanels.batch.control.eventMoveLabel",
    },
    { kind: "event-end", color: "#00aabb", title: "editorPanels.batch.control.eventEnd" },
    { kind: "event-start", color: "#8a2be2", title: "editorPanels.batch.control.eventStart" },
  ],
};
