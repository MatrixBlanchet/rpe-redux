/**
 * Grouping a line's events into continuous chains.
 *
 * The timeline draws one lane per run of events that touch end-to-start, and the
 * preview needs the same runs to know how far a chain reaches vertically. Chain
 * membership is `trajectory`-aware: an event generated from a trajectory
 * contributes samples of its curve to the chain's `min`/`max`, so a lane is sized
 * by what is actually drawn rather than by its endpoint values alone.
 */
import { beatValue, isOrderedBeatRange } from "../../global/chart/timing/beat.ts";
import type { LineEventValue } from "../../global/chart/chart.ts";
import {
  trajectoryEventValue,
  type TrajectoryEventLike,
} from "../../global/chart/trajectory/curveTrajectory.ts";

/** Event data used by continuous event-chain analysis. */
export interface ChainableEvent extends TrajectoryEventLike {
  startTime: number[];
  endTime: number[];
  start?: LineEventValue;
  end?: LineEventValue;
}

export interface EventChainEntry<T> {
  event: T;
  index: number;
}

export interface EventChain<T = ChainableEvent> {
  entries: EventChainEntry<T>[];
  min: number;
  max: number;
}

/** Returns source indexes whose time intervals overlap another event. */
export function overlappingEventIndexes<T extends ChainableEvent>(
  events: readonly T[],
): Set<number> {
  const ordered = events
    .map((event, index) => ({
      event,
      index,
    }))
    .filter((entry) => isOrderedBeatRange(entry.event.startTime, entry.event.endTime))
    .map((entry) => ({
      index: entry.index,
      start: beatValue(entry.event.startTime),
      end: beatValue(entry.event.endTime),
    }))
    .sort((left, right) => left.start - right.start || left.end - right.end);
  const overlapping = new Set<number>();
  let furthestEnd = -Infinity;
  let furthestIndex = -1;
  for (const entry of ordered) {
    if (entry.start < furthestEnd - 1e-8) {
      overlapping.add(entry.index);
      if (furthestIndex >= 0) {
        overlapping.add(furthestIndex);
      }
    }
    if (entry.end > furthestEnd) {
      furthestEnd = entry.end;
      furthestIndex = entry.index;
    }
  }
  return overlapping;
}

/** Groups end-to-start touching events and tracks each group's value range. */
export function eventChains<T extends ChainableEvent>(events: readonly T[]): EventChain<T>[] {
  const groups: EventChain<T>[] = [];
  for (const entry of events
    .map((event, index) => ({ event, index }))
    .filter((entry) => isOrderedBeatRange(entry.event.startTime, entry.event.endTime))
    .sort((left, right) => beatValue(left.event.startTime) - beatValue(right.event.startTime))) {
    let group = groups.at(-1);
    const previous = group?.entries.at(-1);
    if (
      !group ||
      !previous ||
      entry.event.trajectory ||
      previous.event.trajectory ||
      Math.abs(beatValue(previous.event.endTime) - beatValue(entry.event.startTime)) > 1e-8
    ) {
      group = { entries: [], min: Infinity, max: -Infinity };
      groups.push(group);
    }
    group.entries.push(entry);
    if (entry.event.trajectory) {
      for (let index = 0; index <= 64; index++) {
        const value = trajectoryEventValue(entry.event, index / 64);
        group.min = Math.min(group.min, value);
        group.max = Math.max(group.max, value);
      }
    }
    for (const value of [entry.event.start, entry.event.end]) {
      if (typeof value === "number") {
        group.min = Math.min(group.min, value);
        group.max = Math.max(group.max, value);
      }
    }
  }
  return groups;
}
