/**
 * The per-line interval index the timeline queries by beat, and the rule for
 * when it has to be rebuilt: only when the owning line replaced its note array.
 * An edit that mutates the same array keeps the index, which is what makes a
 * drag cheap; a reload that swaps the array invalidates it.
 */

import { beatValue } from "../../global/chart/timing/beat.ts";
import { IntervalIndex } from "../../utils/intervalIndex.ts";
import type { NoteIndex, TimelineNote } from "./types.ts";

/** Rebuilds a line's interval index only when its note array identity changed. */
export function refreshNoteIndex(
  indexes: Map<number, NoteIndex>,
  lineIndex: number,
  notes: TimelineNote[],
): void {
  const cached = indexes.get(lineIndex);
  if (cached?.notes === notes) {
    return;
  }
  if (cached) {
    cached.index.replaceItems(notes);
    cached.notes = notes;
    return;
  }
  indexes.set(lineIndex, {
    notes,
    index: new IntervalIndex(
      notes,
      (note) => beatValue(note.startTime),
      (note) => Math.max(beatValue(note.startTime), beatValue(note.endTime)),
    ),
  });
}
