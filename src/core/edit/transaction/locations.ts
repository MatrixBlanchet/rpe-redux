/**
 * Indexes mutable chart objects for transaction operations without exposing the chart.
 *
 * The line/note/event index is cached per chart object and rebuilt when the line
 * array or a note array changes shape. Commits and undo/redo drop the cache
 * explicitly; an external chart replacement gets a new chart object and a preview
 * chart disappears with its own cache.
 */
import {
  EVENT_TRACKS,
  lineEventLayers,
  type Chart,
  type JudgeLine,
  type JudgeLineNote,
  type LineEventLayer,
  type MutableEventLayer,
} from "../../global/chart/chart.ts";
import { isChartObjectId, type ChartObjectId } from "../../global/chart/identity.ts";
import { isRecord } from "../../utils/guards.ts";

const ROOT_EVENT_KEYS = ["effects", "shaderEvents"] as const;
type RootEventKey = (typeof ROOT_EVENT_KEYS)[number] | "metaEffects";

export interface LocatedLine {
  readonly line: JudgeLine;
  readonly index: number;
}

export interface LocatedNote {
  readonly note: JudgeLineNote;
  readonly line: LocatedLine;
  readonly remove: () => void;
}

/** A note's current position inside its owning line. */
export interface NoteLocation {
  readonly line: JudgeLine;
  readonly lineIndex: number;
  readonly note: JudgeLineNote;
  readonly noteIndex: number;
  readonly notes: JudgeLineNote[];
}

/** One event plus the list that owns it, so callers can replace or remove it. */
export interface LocatedEvent {
  readonly event: Record<string, unknown>;
  readonly line: LocatedLine | null;
  readonly eventIndex: number;
  readonly events: Record<string, unknown>[];
  readonly track: string | null;
  /** 0-based normal layer, -1 for the extended layer, null for a root list. */
  readonly layerIndex: number | null;
  readonly remove: () => void;
}

/** The minimal chart surface needed to locate an event by id. */
export interface EventChart {
  readonly judgeLineList?: readonly unknown[];
}

interface LineNoteIndex {
  /** Line id when the lookup was built; a different line at this slot means reorder. */
  lineId: ChartObjectId | undefined;
  /** The note array the indexed positions describe. */
  notes: JudgeLineNote[];
}

interface NoteIndexEntry {
  readonly lineIndex: number;
  readonly noteIndex: number;
}

interface EventIndexEntry {
  /** Line slot, or -1 for an event stored directly on the chart. */
  readonly lineIndex: number;
  /** Normal layer slot, -1 for the extended layer, null for a root list. */
  readonly layerIndex: number | null;
  /** Event track name, or null for a root list. */
  readonly track: string | null;
  readonly eventIndex: number;
  /** Root list discriminator; absent for line events. */
  readonly root?: RootEventKey;
}

interface ChartLocationIndex {
  readonly lineList: readonly unknown[] | undefined;
  readonly lineCount: number;
  readonly lineById: Map<ChartObjectId, number>;
  readonly lineNotes: LineNoteIndex[];
  readonly noteById: Map<ChartObjectId, NoteIndexEntry>;
  readonly eventById: Map<ChartObjectId, EventIndexEntry>;
}

/** Counters that let tests prove an edit batch stays linear in chart size. */
export interface ChartLocationDiagnostics {
  /** Full index builds, each of which scans every line, note, and event. */
  readonly indexBuilds: number;
  /** Full event scans performed while building an index. */
  readonly eventScans: number;
  /** Event lookups served by an index. */
  readonly eventLookups: number;
}

const locationIndexes = new WeakMap<Chart, ChartLocationIndex>();
const diagnostics = { indexBuilds: 0, eventScans: 0, eventLookups: 0 };

/** Read the current location-index counters. */
export function chartLocationDiagnostics(): ChartLocationDiagnostics {
  return Object.freeze({ ...diagnostics });
}

/** Clear the counters without dropping cached indexes. */
export function resetChartLocationDiagnostics(): void {
  diagnostics.indexBuilds = 0;
  diagnostics.eventScans = 0;
  diagnostics.eventLookups = 0;
}

/** True for an id field the index can address. */
function indexableId(value: unknown): value is ChartObjectId {
  return typeof value === "string" && value.length > 0;
}

/** Returns the chart's root event list for one root key. */
function rootEventList(chart: Chart, root: RootEventKey): Record<string, unknown>[] | null {
  if (root === "metaEffects") {
    const meta = isRecord(chart.META) ? chart.META : undefined;
    return Array.isArray(meta?.effects) ? (meta.effects as Record<string, unknown>[]) : null;
  }
  const events = chart[root];
  return Array.isArray(events) ? (events as Record<string, unknown>[]) : null;
}

/** Builds a complete line/note/event index; the first occurrence wins for duplicate ids. */
function createLocationIndex(chart: Chart): ChartLocationIndex {
  diagnostics.indexBuilds += 1;
  diagnostics.eventScans += 1;
  const lines = chart.judgeLineList ?? [];
  const lineById = new Map<ChartObjectId, number>();
  const lineNotes: LineNoteIndex[] = [];
  const noteById = new Map<ChartObjectId, NoteIndexEntry>();
  const eventById = new Map<ChartObjectId, EventIndexEntry>();
  for (const [lineIndex, value] of lines.entries()) {
    if (!isRecord(value)) {
      lineNotes.push({ lineId: undefined, notes: [] });
      continue;
    }
    const line = value as unknown as JudgeLine;
    const lineId = line.id;
    if (indexableId(lineId) && !lineById.has(lineId)) {
      lineById.set(lineId, lineIndex);
    }
    const notes = Array.isArray(line.notes) ? line.notes : [];
    lineNotes.push({ lineId, notes });
    for (const [noteIndex, note] of notes.entries()) {
      const noteId = note?.id;
      if (indexableId(noteId) && !noteById.has(noteId)) {
        noteById.set(noteId, { lineIndex, noteIndex });
      }
    }
    for (const { layer, layerIndex } of eventLayersOf(line)) {
      for (const track of EVENT_TRACKS) {
        const events = (layer as MutableEventLayer)[track];
        if (!Array.isArray(events)) {
          continue;
        }
        for (const [eventIndex, event] of events.entries()) {
          const eventId = isRecord(event) ? event.id : undefined;
          if (indexableId(eventId) && !eventById.has(eventId)) {
            eventById.set(eventId, { lineIndex, layerIndex, track, eventIndex });
          }
        }
      }
    }
  }
  for (const root of [...ROOT_EVENT_KEYS, "metaEffects"] as const) {
    const events = rootEventList(chart, root);
    if (!events) {
      continue;
    }
    for (const [eventIndex, event] of events.entries()) {
      const eventId = isRecord(event) ? event.id : undefined;
      if (indexableId(eventId) && !eventById.has(eventId)) {
        eventById.set(eventId, { lineIndex: -1, layerIndex: null, track: null, root, eventIndex });
      }
    }
  }
  return {
    lineList: chart.judgeLineList,
    lineCount: lines.length,
    lineById,
    lineNotes,
    noteById,
    eventById,
  };
}

/** Collects ids of every line, note, and event reachable from the chart. */
export function collectChartObjectIds(chart: Chart): Set<ChartObjectId> {
  const ids = new Set<ChartObjectId>();
  const add = (value: unknown): void => {
    if (isChartObjectId(value)) {
      ids.add(value);
    }
  };
  for (const line of chart.judgeLineList ?? []) {
    add(line.id);
    for (const note of line.notes ?? []) {
      add(note.id);
    }
    for (const layer of lineEventLayers(line)) {
      if (!layer) {
        continue;
      }
      for (const type of EVENT_TRACKS) {
        for (const event of (layer as MutableEventLayer)[type] ?? []) {
          add(event.id);
        }
      }
    }
  }
  for (const key of ROOT_EVENT_KEYS) {
    const events = chart[key];
    if (Array.isArray(events)) {
      for (const event of events) {
        if (isRecord(event)) {
          add(event.id);
        }
      }
    }
  }
  const metadataEffects = chart.META.effects;
  if (Array.isArray(metadataEffects)) {
    for (const event of metadataEffects) {
      if (isRecord(event)) {
        add(event.id);
      }
    }
  }
  return ids;
}

/** True while the cached index still describes the chart's line array shape. */
function indexIsCurrent(index: ChartLocationIndex, chart: Chart): boolean {
  return (
    index.lineList === chart.judgeLineList && index.lineCount === (chart.judgeLineList?.length ?? 0)
  );
}

/** Returns the chart's cached index, rebuilding it after a structural replacement. */
function chartLocations(chart: Chart): ChartLocationIndex {
  const cached = locationIndexes.get(chart);
  if (cached && indexIsCurrent(cached, chart)) {
    return cached;
  }
  const index = createLocationIndex(chart);
  locationIndexes.set(chart, index);
  return index;
}

/** Replaces the cached index with a fresh build and returns it. */
function rebuildLocations(chart: Chart): ChartLocationIndex {
  const index = createLocationIndex(chart);
  locationIndexes.set(chart, index);
  return index;
}

/** Rebuilds a chart's cached index once after a structural change. */
export function rebuildChartLocations(chart: Chart): void {
  rebuildLocations(chart);
}

/** Scans the chart directly when no index has been built for this version. */
function scanNote(chart: Chart, id: ChartObjectId): NoteLocation | null {
  for (const [lineIndex, line] of (chart.judgeLineList ?? []).entries()) {
    const notes = line.notes ?? [];
    const noteIndex = notes.findIndex((note) => note.id === id);
    if (noteIndex < 0) {
      continue;
    }
    const note = notes[noteIndex];
    if (note) {
      return { line, lineIndex, note, noteIndex, notes };
    }
  }
  return null;
}

/** Builds and caches the chart's note/line index for a batch of id lookups. */
export function ensureChartLocations(chart: Chart): void {
  chartLocations(chart);
}

/**
 * Finds a note's current line/array position.
 *
 * A cached index answers in constant time. A known id whose array reference
 * moved rebuilds once; an unknown id returns null without scanning the chart.
 */
export function locateNote(chart: Chart, id: ChartObjectId): NoteLocation | null {
  const index = locationIndexes.get(chart);
  if (!index) {
    return scanNote(chart, id);
  }
  if (!indexIsCurrent(index, chart)) {
    return lookupNote(rebuildLocations(chart), chart, id);
  }
  if (!index.noteById.has(id)) {
    return null;
  }
  return lookupNote(index, chart, id) ?? lookupNote(rebuildLocations(chart), chart, id);
}

/** Looks up one note without rebuilding; null means missing or stale. */
function lookupNote(
  index: ChartLocationIndex,
  chart: Chart,
  id: ChartObjectId,
): NoteLocation | null {
  const entry = index.noteById.get(id);
  if (!entry) {
    return null;
  }
  const { lineIndex, noteIndex } = entry;
  const line = chart.judgeLineList?.[lineIndex];
  const lookup = index.lineNotes[lineIndex];
  if (!line || !lookup || lookup.lineId !== line.id) {
    return null;
  }
  const notes = line.notes ?? [];
  if (notes !== lookup.notes) {
    return null;
  }
  const note = notes[noteIndex];
  if (!note || note.id !== id) {
    return null;
  }
  return { line, lineIndex, note, noteIndex, notes };
}

/**
 * Finds a judge line by id.
 *
 * A known id with a stale position rebuilds once; an unknown id returns null
 * without rebuilding the whole index.
 */
export function locateLine(chart: Chart, id: ChartObjectId): LocatedLine | null {
  const lookup = (index: ChartLocationIndex): LocatedLine | null => {
    const lineIndex = index.lineById.get(id);
    if (lineIndex === undefined) {
      return null;
    }
    const line = chart.judgeLineList?.[lineIndex];
    return line?.id === id ? { line, index: lineIndex } : null;
  };
  const index = locationIndexes.get(chart);
  if (!index) {
    const lineIndex = (chart.judgeLineList ?? []).findIndex((line) => line.id === id);
    const line = chart.judgeLineList?.[lineIndex];
    return line ? { line, index: lineIndex } : null;
  }
  if (!indexIsCurrent(index, chart)) {
    return lookup(rebuildLocations(chart));
  }
  if (!index.lineById.has(id)) {
    return null;
  }
  return lookup(index) ?? lookup(rebuildLocations(chart));
}

/**
 * Updates the cached index after the transaction clones a note array.
 *
 * The array keeps the same order, so its indexed positions stay valid.
 */
export function setLineNotesRef(chart: Chart, lineIndex: number, notes: JudgeLineNote[]): void {
  const index = locationIndexes.get(chart);
  if (!index || !indexIsCurrent(index, chart)) {
    return;
  }
  const line = chart.judgeLineList?.[lineIndex];
  const lookup = index.lineNotes[lineIndex];
  if (!line || !lookup || lookup.lineId !== line.id) {
    return;
  }
  lookup.notes = notes;
}

/** Records a newly inserted note in the cached index when one already exists. */
export function registerNoteInIndex(
  chart: Chart,
  lineIndex: number,
  id: ChartObjectId,
  noteIndex: number,
): void {
  const index = locationIndexes.get(chart);
  if (!index || !indexIsCurrent(index, chart)) {
    return;
  }
  const line = chart.judgeLineList?.[lineIndex];
  const lookup = index.lineNotes[lineIndex];
  if (!line || !lookup || lookup.lineId !== line.id || lookup.notes !== line.notes) {
    return;
  }
  if (!index.noteById.has(id)) {
    index.noteById.set(id, { lineIndex, noteIndex });
  }
}

/** Records a newly inserted line event in the cached index when one already exists. */
export function registerEventInIndex(
  chart: Chart,
  lineIndex: number,
  layerIndex: number,
  track: string,
  id: ChartObjectId,
  eventIndex: number,
): void {
  const index = locationIndexes.get(chart);
  if (!index || !indexIsCurrent(index, chart)) {
    return;
  }
  if (!index.eventById.has(id)) {
    index.eventById.set(id, { lineIndex, layerIndex, track, eventIndex });
  }
}

/** Drops a chart's cached location index after a commit, undo, or replacement. */
export function invalidateChartLocations(chart: Chart): void {
  locationIndexes.delete(chart);
}

/** Finds a note by id and exposes a remover bound to its owning array. */
export function findNote(chart: Chart, id: ChartObjectId): LocatedNote | null {
  const located = locateNote(chart, id);
  if (!located) {
    return null;
  }
  const { note, line, lineIndex, noteIndex } = located;
  return {
    note,
    line: { line, index: lineIndex },
    remove: () => {
      const notes = line.notes;
      if (!notes) {
        return;
      }
      const index = notes[noteIndex] === note ? noteIndex : notes.indexOf(note);
      if (index >= 0) {
        notes.splice(index, 1);
      }
      invalidateChartLocations(chart);
    },
  };
}

/** Resolves a root event's optional line index to its line. */
function lineForEvent(chart: Chart, event: Record<string, unknown>): LocatedLine | null {
  const value = event.line;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    return null;
  }
  const line = chart.judgeLineList?.[value];
  return line ? { line, index: value } : null;
}

/** Enumerates a line's normal layers and its extended layer with their indices. */
function eventLayersOf(line: JudgeLine): { layer: LineEventLayer; layerIndex: number }[] {
  const layers: { layer: LineEventLayer; layerIndex: number }[] = [];
  const normal = Array.isArray(line.eventLayers) ? line.eventLayers : [];
  for (const [index, layer] of normal.entries()) {
    if (isRecord(layer)) {
      layers.push({ layer: layer as LineEventLayer, layerIndex: index });
    }
  }
  if (isRecord(line.extended)) {
    layers.push({ layer: line.extended as LineEventLayer, layerIndex: -1 });
  }
  return layers;
}

/** Builds the public located-event record for one owning array. */
function locatedEvent(
  chart: Chart,
  event: Record<string, unknown>,
  line: LocatedLine | null,
  events: Record<string, unknown>[],
  track: string | null,
  layerIndex: number | null,
  eventIndex: number,
): LocatedEvent {
  return {
    event,
    line,
    eventIndex,
    events,
    track,
    layerIndex,
    remove: () => events.splice(eventIndex, 1),
  };
}

/** Looks up one indexed line or root event; null means missing or stale. */
function lookupEvent(
  index: ChartLocationIndex,
  chart: Chart,
  id: ChartObjectId,
): LocatedEvent | null {
  const entry = index.eventById.get(id);
  if (!entry) {
    return null;
  }
  if (entry.root) {
    const events = rootEventList(chart, entry.root);
    if (!events) {
      return null;
    }
    const eventIndex = eventIndexFor(events, id, entry.eventIndex);
    const event = eventIndex < 0 ? undefined : events[eventIndex];
    if (!event) {
      return null;
    }
    if (eventIndex !== entry.eventIndex) {
      index.eventById.set(id, { ...entry, eventIndex });
    }
    return locatedEvent(chart, event, lineForEvent(chart, event), events, null, null, eventIndex);
  }
  const line = chart.judgeLineList?.[entry.lineIndex];
  if (!line || entry.track === null || entry.layerIndex === null) {
    return null;
  }
  const layer = eventLayersOf(line).find((candidate) => candidate.layerIndex === entry.layerIndex);
  if (!layer) {
    return null;
  }
  const events = (layer.layer as MutableEventLayer)[entry.track];
  if (!Array.isArray(events)) {
    return null;
  }
  const eventIndex = eventIndexFor(events, id, entry.eventIndex);
  const event = eventIndex < 0 ? undefined : events[eventIndex];
  if (!event) {
    return null;
  }
  if (eventIndex !== entry.eventIndex) {
    index.eventById.set(id, { ...entry, eventIndex });
  }
  return locatedEvent(
    chart,
    event,
    { line, index: entry.lineIndex },
    events as unknown as Record<string, unknown>[],
    entry.track,
    entry.layerIndex,
    eventIndex,
  );
}

/** Finds an event id at its expected slot or by scanning only that one track. */
function eventIndexFor(events: readonly unknown[], id: ChartObjectId, expected: number): number {
  const candidate = events[expected];
  if (isRecord(candidate) && candidate.id === id) {
    return expected;
  }
  return events.findIndex((event) => isRecord(event) && event.id === id);
}

/**
 * Finds an event by id across line layers and root event lists.
 *
 * This is the single event locator shared by the transaction kernel and the
 * AI editing policy. A cached index answers a known id in constant time relative
 * to chart size; a stale position rebuilds the index once.
 */
export function findEvent(chart: EventChart, id: ChartObjectId): LocatedEvent | null {
  diagnostics.eventLookups += 1;
  const target = chart as Chart;
  const index = chartLocations(target);
  const cached = lookupEvent(index, target, id);
  if (cached) {
    return cached;
  }
  if (!index.eventById.has(id)) {
    return null;
  }
  return lookupEvent(rebuildLocations(target), target, id);
}
