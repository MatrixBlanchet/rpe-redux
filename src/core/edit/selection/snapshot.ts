/**
 * What is selected right now, as data.
 *
 * A batch edit reads the selection once, transforms that snapshot, and commits
 * it; nothing downstream looks at the live session again, so a gesture cannot
 * see the chart half-edited. The multi-line selections are flattened here, which
 * is why every entry carries its own line.
 */

import { eventListAt, parseEventKey } from "../events/eventTracks.ts";
import { selectedEvents } from "../events/eventEdits.ts";
import type { Chart, JudgeLineEvent, JudgeLineNote } from "../../global/chart/chart.ts";
import type { EditorFocus, EditorSession } from "../session/session.ts";

export interface NoteCaptureEntry {
  lineIndex: number;
  index: number;
  note: JudgeLineNote;
}

/** One captured event with the track and line it came from. */
export interface EventCaptureEntry {
  type: string;
  index: number;
  lineIndex: number;
  event: JudgeLineEvent;
}

/** The selection captured before a batch edit, as `editCapturedSelection` reads it. */
export interface SelectionSnapshot {
  chart: Chart;
  lineIndex: number;
  eventLayer: number;
  focus: EditorFocus;
  shaderAutoAlign?: boolean;
  notes: NoteCaptureEntry[];
  events: EventCaptureEntry[];
}

/** Captures the active line, focus, and selected notes or events as data. */
export function captureSelection(session: EditorSession): SelectionSnapshot {
  const events: EventCaptureEntry[] =
    session.multiLineActive && session.multiLineMode === "events"
      ? [...(session.multiEventSelection ?? new Map())].flatMap(([lineIndex, selection]) =>
          [...selection].flatMap((key) => {
            const parsed = parseEventKey(String(key));
            if (!parsed) {
              return [];
            }
            const event = eventListAt(session, lineIndex, parsed.type)[parsed.index];
            return event ? [{ ...parsed, lineIndex, event }] : [];
          }),
        )
      : selectedEvents(session).map((entry) => ({ ...entry, lineIndex: session.lineIndex }));
  const notes: NoteCaptureEntry[] =
    session.multiLineActive && session.multiLineMode === "notes"
      ? [...(session.multiLineSelection ?? new Map())]
          .flatMap(([lineIndex, selection]) =>
            [...selection].map((index) => ({
              lineIndex,
              index,
              note: session.chart.judgeLineList?.[lineIndex]?.notes?.[index],
            })),
          )
          .filter((entry): entry is NoteCaptureEntry => Boolean(entry.note))
      : [...session.selection]
          .sort((left, right) => left - right)
          .filter((index) => session.notes[index])
          .map((index) => ({ lineIndex: session.lineIndex, index, note: session.notes[index] }));
  return {
    chart: session.chart,
    lineIndex: session.lineIndex,
    eventLayer: session.eventLayer,
    focus: session.focus,
    shaderAutoAlign: session.shaderAutoAlign,
    notes,
    events,
  };
}
