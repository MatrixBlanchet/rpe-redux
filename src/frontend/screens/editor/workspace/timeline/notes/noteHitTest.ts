/** Answers which notes the field shows and which one the pointer is over. */
import {
  hitTimelineNote,
  timelineNoteCandidates,
} from "../../../../../../core/edit/timeline/hitTest.ts";
import type {
  TimelineNoteEntry,
  TimelinePoint,
} from "../../../../../../core/edit/timeline/types.ts";
import type { TimelineNoteHitTestReceiver } from "../drawing/timelineReceiver.ts";

/** Refresh one line's cached note index from the chart. */
export function refreshIndex(
  this: TimelineNoteHitTestReceiver,
  lineIndex: number = this.getSession().lineIndex,
): void {
  this.cache.refreshNotes(
    lineIndex,
    this.getSession().chart.judgeLineList?.[lineIndex]?.notes ?? [],
  );
}

/** The notes currently inside the viewport on one line. */
export function visible(
  this: TimelineNoteHitTestReceiver,
  lineIndex: number = this.getSession().lineIndex,
): TimelineNoteEntry[] {
  this.refreshIndex(lineIndex);
  const [bottom, top] = this.viewport.noteBeatRangeForLine(lineIndex);
  return this.cache.visibleNotes(lineIndex, bottom, top);
}

/** Notes under `position` across every panel a merged note view can hit. */
function candidates(
  this: TimelineNoteHitTestReceiver,
  position: TimelinePoint,
): TimelineNoteEntry[] {
  const session = this.getSession();
  const lineIndices =
    session.multiLineActive &&
    session.multiLineMode === "notes" &&
    this.viewport.panelCount("notes") === 1
      ? session.targetLineIndices
      : [this.viewport.lineIndexAt(position.x, this.notesCanvas.clientWidth, "notes")];
  return timelineNoteCandidates(
    lineIndices.flatMap((lineIndex) => this.visible(lineIndex)),
    position,
    {
      horizontal: (note, lineIndex) => {
        const horizontal = this.viewport.noteHorizontal(note.positionX, lineIndex);
        return (
          this.viewport.clampNoteHorizontal(
            horizontal,
            this.viewport.noteWidth(note),
            this.notesCanvas.clientWidth,
            lineIndex,
          ) ?? horizontal
        );
      },
      width: (note) => this.viewport.noteWidth(note),
      halfHeight: (note, width) => {
        const skin = this.appearance.skin;
        const texture =
          note.type === 2 ? skin?.holdHeadTexture(false) : skin?.noteTexture(note.type, false);
        return texture && texture.useful.width > 0
          ? (width * texture.useful.height) / texture.useful.width / 2
          : 4;
      },
      visible: (horizontal, width, lineIndex) =>
        this.viewport.clampNoteHorizontal(
          horizontal,
          width,
          this.notesCanvas.clientWidth,
          lineIndex,
        ) !== null,
      vertical: (beat, lineIndex) => this.viewport.noteVerticalForLine(beat, lineIndex),
    },
    true,
  );
}

/** The topmost note under `position`. */
export function hit(
  this: TimelineNoteHitTestReceiver,
  position: TimelinePoint,
): TimelineNoteEntry | undefined {
  return hitTimelineNote(
    this.visible(this.viewport.lineIndexAt(position.x, this.notesCanvas.clientWidth, "notes")),
    position,
    {
      horizontal: (note, lineIndex) => this.viewport.noteHorizontal(note.positionX, lineIndex),
      width: (note) => this.viewport.noteWidth(note),
      visible: (horizontal, width, lineIndex) =>
        this.viewport.clampNoteHorizontal(
          horizontal,
          width,
          this.notesCanvas.clientWidth,
          lineIndex,
        ) !== null,
      vertical: (beat, lineIndex) => this.viewport.noteVerticalForLine(beat, lineIndex),
    },
  );
}

/** Every note under `position`, used for the overlap picker. */
export function hits(
  this: TimelineNoteHitTestReceiver,
  position: TimelinePoint,
): TimelineNoteEntry[] {
  return candidates.call(this, position);
}
