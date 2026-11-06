/**
 * Detects overlapping event intervals on one track.
 *
 * Events on the same line, layer, and track must not overlap. The sweep sorts
 * by start beat once, then only compares events whose intervals are still open,
 * so a clean track costs one sort and one linear pass instead of the pairwise
 * nested loop used by placement validation.
 */
import type { JudgeLineEvent } from "../../global/chart/chart.ts";
import { beatCopy, beatValue, compareBeats, type Beat } from "../../global/chart/timing/beat.ts";

/** One pair of events whose open intervals overlap. */
export interface EventOverlapPair {
  /** Earlier source index in the track. */
  firstIndex: number;
  /** Later source index in the track. */
  secondIndex: number;
  /** First beat shared by both intervals. */
  startTime: Beat;
  /** First beat after the shared interval. */
  endTime: Beat;
}

/** Beat comparison tolerance shared with the timeline's event chains. */
const EPSILON = 1e-8;

const EMPTY_PAIRS: readonly EventOverlapPair[] = Object.freeze([]);

/** One open interval in the sweep. */
interface SweepEntry {
  event: JudgeLineEvent;
  index: number;
  start: number;
  end: number;
}

/** Whether the source is already ordered by start beat. */
function sortedByStart(entries: readonly SweepEntry[]): boolean {
  for (let index = 1; index < entries.length; index += 1) {
    if (entries[index].start < entries[index - 1].start) {
      return false;
    }
  }
  return true;
}

/**
 * Find every pair of overlapping event intervals in source order.
 *
 * Ranges that only touch at an endpoint are valid and are not reported. A
 * zero-length event never overlaps another event. The returned pairs are ordered
 * by their shared start beat, then by source index, so a consumer can render a
 * stable list without another sort.
 */
export function eventOverlapPairs(events: readonly JudgeLineEvent[]): readonly EventOverlapPair[] {
  if (events.length < 2) {
    return EMPTY_PAIRS;
  }
  const entries: SweepEntry[] = events
    .map((event, index) => ({
      event,
      index,
      start: beatValue(event.startTime),
      end: beatValue(event.endTime),
    }))
    .filter((entry) => entry.end > entry.start);
  if (entries.length < 2) {
    return EMPTY_PAIRS;
  }
  if (!sortedByStart(entries)) {
    entries.sort(
      (left, right) => left.start - right.start || left.end - right.end || left.index - right.index,
    );
  }

  const pairs: EventOverlapPair[] = [];
  const active: SweepEntry[] = [];
  for (const entry of entries) {
    // Intervals that end before this start cannot overlap it or any later
    // interval, so they leave the active set permanently.
    for (let index = active.length - 1; index >= 0; index -= 1) {
      if (active[index].end <= entry.start + EPSILON) {
        active.splice(index, 1);
      }
    }
    for (const other of active) {
      const end = Math.min(other.end, entry.end);
      if (end - entry.start <= EPSILON) {
        continue;
      }
      const first = other.index < entry.index ? other : entry;
      const second = other.index < entry.index ? entry : other;
      const startTime =
        compareBeats(first.event.startTime, second.event.startTime) >= 0
          ? first.event.startTime
          : second.event.startTime;
      const endTime =
        compareBeats(first.event.endTime, second.event.endTime) <= 0
          ? first.event.endTime
          : second.event.endTime;
      pairs.push({
        firstIndex: first.index,
        secondIndex: second.index,
        startTime: beatCopy(startTime),
        endTime: beatCopy(endTime),
      });
    }
    active.push(entry);
  }
  if (!pairs.length) {
    return EMPTY_PAIRS;
  }
  pairs.sort(
    (left, right) =>
      beatValue(left.startTime) - beatValue(right.startTime) ||
      left.firstIndex - right.firstIndex ||
      left.secondIndex - right.secondIndex,
  );
  return pairs;
}
