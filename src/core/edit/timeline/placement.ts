/**
 * Turning a click into chart content: the one module among the timeline's input
 * helpers that writes to the session.
 *
 * It reads no viewport and no snap geometry — the caller has already turned the
 * pointer into a beat and a position — so a placement can be reasoned about (and
 * tested) without a canvas, and the hit-testing and preview modules stay pure.
 * The two-click hold lives here too, because "a half-placed hold" is session
 * input state rather than a drawing concern.
 */

import { fromNumber } from "../../global/chart/timing/beat.ts";
import { placementRange } from "../../global/chart/editing/editGrid.ts";
import type { EditorSession } from "../session/session.ts";
import type { PendingHold } from "./types.ts";
import { placeNoteAtTarget } from "./noteCommands.ts";
import type { ActionTarget } from "../operations/result.ts";

/**
 * Places an instant note or starts/finishes a two-click hold at the target.
 * Returns the pending hold state after the click.
 */
export function placeTimelineNote(
  session: EditorSession,
  type: number,
  beat: number,
  positionX: number,
  lineIndex: number,
  pending: PendingHold | null,
): PendingHold | null {
  session.focus = "notes";
  session.eventSelection.clear();
  if (!Number.isFinite(positionX)) {
    return pending;
  }
  if (type !== 2) {
    placeNoteAtTarget(session, type as 1 | 2 | 3 | 4, {
      lineIndex,
      from: { beat, positionX },
    });
    return pending;
  }
  if (!pending) {
    return { beat, positionX, lineIndex };
  }
  const range = placementRange(fromNumber(pending.beat), fromNumber(beat));
  if (range && Number.isFinite(pending.positionX)) {
    // A Hold has one chart X coordinate. The second click supplies its end
    // time; the visual tail is independent of the head's X coordinate.
    const target: ActionTarget = {
      lineIndex: pending.lineIndex,
      from: { beat: range.start, positionX: pending.positionX },
      to: { beat: range.end, positionX: pending.positionX },
    };
    placeNoteAtTarget(session, 2, target);
  }
  return null;
}
