/**
 * Marks same-beat, non-Hold notes that are close enough to overlap in the note
 * field, so a pointer click chooses deliberately rather than by paint order.
 *
 * "Close" is expressed in chart units because the lanes are authored in that
 * space. The threshold is a fixed distance rather than a multiple of the X-axis
 * grid spacing, so changing the snap lane count does not change which notes are
 * marked. The settings row that owns the value starts at
 * `DEFAULT_NOTE_OVERLAP_THRESHOLD`. Beat ties use the same epsilon as the event
 * overlap sweep, since beat triples are exact rationals that may be unnormalised.
 */

import { beatValue } from "../../global/chart/timing/beat.ts";
import type { TimelineNote } from "./types.ts";

const SAME_BEAT_EPSILON = 1e-8;

/** Default distance, in chart units, that marks two same-beat notes as overlapping. */
export const DEFAULT_NOTE_OVERLAP_THRESHOLD = 100;

/**
 * Positions (not note indices) in `notes` that sit on the same beat as another
 * non-Hold note within `thresholdX` chart units. A non-positive threshold turns
 * the marking off.
 */
export function overlappingNotePositions(
  notes: readonly TimelineNote[],
  thresholdX: number,
): Set<number> {
  const positions = new Set<number>();
  if (!(thresholdX > 0) || notes.length < 2) {
    return positions;
  }
  const candidates: Array<{ position: number; beat: number; x: number }> = [];
  notes.forEach((note, position) => {
    // A Hold's body is meant to span time and is excluded by definition.
    if (Number(note.type) === 2) {
      return;
    }
    candidates.push({ position, beat: beatValue(note.startTime), x: note.positionX });
  });
  candidates.sort((left, right) => left.beat - right.beat || left.x - right.x);
  for (let first = 0; first < candidates.length; first += 1) {
    const anchor = candidates[first];
    for (let second = first + 1; second < candidates.length; second += 1) {
      const candidate = candidates[second];
      if (candidate.beat - anchor.beat > SAME_BEAT_EPSILON) {
        break;
      }
      if (Math.abs(candidate.x - anchor.x) < thresholdX) {
        positions.add(anchor.position);
        positions.add(candidate.position);
      }
    }
  }
  return positions;
}
