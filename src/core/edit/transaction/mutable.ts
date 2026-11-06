/**
 * Copy-on-write helpers for one transaction's working chart.
 *
 * A transaction shallow-copies a judge line on first touch, then copies only
 * the note array, event layer, or event track it actually mutates. The source
 * chart therefore keeps every object identity it had before the request.
 */
import {
  countScoringNotes,
  EVENT_TYPES,
  isEventTrack,
  type Chart,
  type JudgeLine,
  type JudgeLineEvent,
  type JudgeLineNote,
  type MutableEventLayer,
} from "../../global/chart/chart.ts";
import type { ChartObjectId } from "../../global/chart/identity.ts";
import type { TransactionIssue } from "./contract.ts";
import { setLineNotesRef, type LocatedEvent, type LocatedLine } from "./locations.ts";

/** Mutable state shared by the transaction apply kernel and its helpers. */
export interface MutableTransactionState {
  readonly chart: Chart;
  readonly issues: TransactionIssue[];
  readonly affected: ChartObjectId[];
  readonly usedIds: Set<ChartObjectId>;
  readonly relationTouched: Set<ChartObjectId>;
  readonly clonedLines: Set<number>;
  /** Deduplicates `affected` without scanning it on every add. */
  affectedSet?: Set<ChartObjectId>;
  /** False defers the full id scan until the first insert needs it. */
  usedIdsReady?: boolean;
  /** Line indices whose note arrays were copied for this transaction. */
  clonedNoteLines?: Set<number>;
  /** Line indices whose `numOfNotes` must be recomputed once at the end. */
  noteCountLines?: Set<number>;
  /** Line indices whose event-layer arrays were copied. */
  clonedEventLayerArrays?: Set<number>;
  /** `lineIndex:layerIndex` keys whose layer objects were copied. */
  clonedEventLayerObjects?: Set<string>;
  /** Line indices whose extended layer object was copied. */
  clonedExtendedLayers?: Set<number>;
  /** `lineIndex:layerIndex:track` keys whose event arrays were copied. */
  eventTracks?: Map<string, Record<string, unknown>[]>;
}

/** Build one immutable transaction issue with optional path/object context. */
export function issue(
  code: string,
  path?: string,
  objectId?: ChartObjectId,
  message?: string,
): TransactionIssue {
  return Object.freeze({
    code,
    ...(path ? { path } : {}),
    ...(objectId ? { objectId } : {}),
    ...(message ? { message } : {}),
  });
}

/** Returns the line's shallow working copy; nested arrays are copied on demand. */
export function mutableLine(state: MutableTransactionState, located: LocatedLine): JudgeLine {
  if (!state.clonedLines.has(located.index)) {
    const clone: JudgeLine = { ...located.line };
    state.chart.judgeLineList![located.index] = clone;
    state.clonedLines.add(located.index);
    return clone;
  }
  return state.chart.judgeLineList?.[located.index] ?? located.line;
}

/** Returns the line's private notes array, copying it on first note mutation. */
export function mutableNotes(
  state: MutableTransactionState,
  line: JudgeLine,
  lineIndex: number,
): JudgeLineNote[] {
  const cloned = (state.clonedNoteLines ??= new Set<number>());
  if (!cloned.has(lineIndex)) {
    line.notes = [...(line.notes ?? [])];
    cloned.add(lineIndex);
    setLineNotesRef(state.chart, lineIndex, line.notes);
  }
  line.notes ??= [];
  return line.notes;
}

/** Replaces one note with a shallow copy so the source chart keeps its object. */
export function mutableNote(notes: JudgeLineNote[], index: number): JudgeLineNote {
  const clone: JudgeLineNote = { ...notes[index] };
  notes[index] = clone;
  return clone;
}

/** Marks a line whose scoring count must be recomputed after all note operations. */
export function markNoteCount(state: MutableTransactionState, lineIndex: number): void {
  (state.noteCountLines ??= new Set<number>()).add(lineIndex);
}

/** Recomputes each touched line's scoring count exactly once. */
export function refreshNoteCounts(state: MutableTransactionState): void {
  const lines = state.noteCountLines;
  if (!lines?.size) {
    return;
  }
  for (const lineIndex of lines) {
    const line = state.chart.judgeLineList?.[lineIndex];
    if (line) {
      line.numOfNotes = countScoringNotes(line.notes);
    }
  }
  lines.clear();
}

/** Returns the line's private event-layer array, copying it on first event mutation. */
function mutableEventLayerArray(
  state: MutableTransactionState,
  line: JudgeLine,
  lineIndex: number,
): (MutableEventLayer | null)[] {
  const cloned = (state.clonedEventLayerArrays ??= new Set<number>());
  if (!cloned.has(lineIndex)) {
    line.eventLayers = [...(line.eventLayers ?? [])];
    cloned.add(lineIndex);
  }
  return line.eventLayers as (MutableEventLayer | null)[];
}

/** Returns one private normal event layer, copying it on first mutation. */
function mutableEventLayer(
  state: MutableTransactionState,
  line: JudgeLine,
  lineIndex: number,
  layerIndex: number,
): MutableEventLayer {
  const layers = mutableEventLayerArray(state, line, lineIndex);
  while (layers.length <= layerIndex) {
    layers.push({});
  }
  const key = `${lineIndex}:${layerIndex}`;
  const cloned = (state.clonedEventLayerObjects ??= new Set<string>());
  if (!cloned.has(key)) {
    layers[layerIndex] = { ...(layers[layerIndex] ?? {}) };
    cloned.add(key);
  }
  return layers[layerIndex] as MutableEventLayer;
}

/** Returns the private extended layer, copying it on first mutation. */
function mutableExtendedLayer(
  state: MutableTransactionState,
  line: JudgeLine,
  lineIndex: number,
): MutableEventLayer {
  const cloned = (state.clonedExtendedLayers ??= new Set<number>());
  if (!cloned.has(lineIndex)) {
    line.extended = { ...(line.extended ?? {}) };
    cloned.add(lineIndex);
  }
  return line.extended as MutableEventLayer;
}

/** Returns one private event track array, copying it on first mutation. */
export function mutableEventTrack(
  state: MutableTransactionState,
  line: JudgeLine,
  lineIndex: number,
  layerIndex: number,
  eventType: string,
): Record<string, unknown>[] {
  const layer =
    layerIndex === -1
      ? mutableExtendedLayer(state, line, lineIndex)
      : mutableEventLayer(state, line, lineIndex, layerIndex);
  const key = `${lineIndex}:${layerIndex}:${eventType}`;
  const tracks = (state.eventTracks ??= new Map<string, Record<string, unknown>[]>());
  let events = tracks.get(key);
  if (!events) {
    events = [...((layer[eventType] as JudgeLineEvent[] | undefined) ?? [])] as unknown as Record<
      string,
      unknown
    >[];
    (layer as Record<string, unknown>)[eventType] = events;
    tracks.set(key, events);
  }
  return events;
}

/** Ensures a mutable event list exists for a track and layer. */
export function ensureEventList(
  line: JudgeLine,
  lineIndex: number,
  eventType: string,
  layer: number | "extended" | undefined,
  path: string,
  state: MutableTransactionState,
): JudgeLineEvent[] | null {
  if (!isEventTrack(eventType)) {
    state.issues.push(issue("event.type.unsupported", `${path}.eventType`));
    return null;
  }
  const isBaseTrack = EVENT_TYPES.includes(eventType as (typeof EVENT_TYPES)[number]);
  if (isBaseTrack) {
    if (layer !== undefined && (!Number.isInteger(layer) || (layer as number) < 0)) {
      state.issues.push(issue("event.layer.invalid", `${path}.layer`));
      return null;
    }
    const layerIndex = typeof layer === "number" ? layer : 0;
    return mutableEventTrack(
      state,
      line,
      lineIndex,
      layerIndex,
      eventType,
    ) as unknown as JudgeLineEvent[];
  }
  if (layer !== undefined && layer !== "extended") {
    state.issues.push(issue("event.layer.extendedRequired", `${path}.layer`));
    return null;
  }
  return mutableEventTrack(state, line, lineIndex, -1, eventType) as unknown as JudgeLineEvent[];
}

/** Returns the private event list for a located event, copying line containers on demand. */
export function mutableEventListFor(
  state: MutableTransactionState,
  located: LocatedEvent,
): Record<string, unknown>[] {
  if (!located.line || located.layerIndex === null || !located.track) {
    return located.events;
  }
  const line = mutableLine(state, located.line);
  return mutableEventTrack(state, line, located.line.index, located.layerIndex, located.track);
}
