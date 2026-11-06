/**
 * Shared primitives for the interchange chart formats.
 *
 * Official Phigros JSON and PhiEdit PEC both need the same few things: a valid
 * RPE chart shell, beat triples from decimal values, line/event records with the
 * defaults the editor expects, and a small warning budget. Format-specific
 * parsing and sampling stay in `official.ts` and `pec.ts`; nothing here reads a
 * file or touches a platform.
 */
import {
  CURRENT_RPE_VERSION,
  DEFAULT_BEZIER_POINTS,
  NO_LINE_PARENT,
  countScoringNotes,
  importedLineZOrder,
  type Chart,
  type ChartMeta,
  type JudgeLine,
  type JudgeLineEvent,
  type JudgeLineNote,
  type LineEventLayer,
} from "../chart.ts";
import { fromNumber, type Beat } from "../timing/beat.ts";
import { isRecord } from "../../../utils/guards.ts";

/** Metadata that a sidecar or the caller supplies for a format without META. */
export interface ExternalChartMetadata {
  name?: string;
  composer?: string;
  charter?: string;
  illustrator?: string;
  level?: string;
  song?: string;
  background?: string;
  offsetMs?: number;
}

/** A converted chart plus the non-fatal issues found while reading it. */
export interface ConvertedExternalChart {
  chart: Chart;
  warnings: string[];
}

/** A serialized chart plus the features the target could not carry. */
export interface SerializedExternalChart {
  text: string;
  warnings: string[];
}

/** Official note type -> RPE note type: Tap, Drag, Hold, Flick. */
export const OFFICIAL_NOTE_TO_RPE: Readonly<Record<number, number>> = Object.freeze({
  1: 1,
  2: 4,
  3: 2,
  4: 3,
});

/** PEC note command -> RPE note type: Tap, Drag, Flick, Hold. */
export const PEC_NOTE_TO_RPE: Readonly<Record<string, number>> = Object.freeze({
  n1: 1,
  n2: 2,
  n3: 3,
  n4: 4,
});

/** RPE note type -> PEC note command. */
export const RPE_NOTE_TO_PEC: Readonly<Record<number, string>> = Object.freeze({
  1: "n1",
  2: "n2",
  3: "n3",
  4: "n4",
});

/** RPE note type -> official note type: Tap, Drag, Hold, Flick. */
export const RPE_NOTE_TO_OFFICIAL: Readonly<Record<number, number>> = Object.freeze({
  1: 1,
  2: 3,
  3: 4,
  4: 2,
});

/** RPE chart units per official X unit (the official field spans about -9..9). */
export const RPE_UNITS_PER_OFFICIAL_X = 75;

/** RPE pixels per official Y unit, derived from the 120 px speed unit rule. */
export const RPE_PIXELS_PER_OFFICIAL_Y = 540;

/** RPE speed units per official speed unit. */
export const RPE_SPEED_PER_OFFICIAL_SPEED = 4.5;

/** RPE speed units per PEC speed unit. */
export const RPE_SPEED_PER_PEC_SPEED = 10 / 17.111;

/** PEC line coordinates: centre and half extents. */
export const PEC_LINE_CENTER_X = 1024;
export const PEC_LINE_CENTER_Y = 700;
export const PEC_LINE_HALF_WIDTH = 1024;
export const PEC_LINE_HALF_HEIGHT = 700;

/** RPE line coordinates: half extents. */
export const RPE_LINE_HALF_WIDTH = 675;
export const RPE_LINE_HALF_HEIGHT = 450;

/** PEC caps PhiEdit's chart at this many judge lines. */
export const PEC_MAX_LINES = 30;

/** Read a finite number, or return the fallback for non-numbers and NaN. */
export function finiteNumber(value: unknown, fallback = 0): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** Read a finite positive number, or return the fallback. */
export function positiveNumber(value: unknown, fallback: number): number {
  const parsed = finiteNumber(value, fallback);
  return parsed > 0 ? parsed : fallback;
}

/** A number with no floating-point dust in the written file. */
export function roundNumber(value: number, digits = 6): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/** A text number for PEC, with trailing zeroes removed. */
export function textNumber(value: number, digits = 6): string {
  return String(roundNumber(value, digits));
}

/** A beat triple from a decimal beat, with the editor's default resolution. */
export function beatFromNumber(value: number): Beat {
  return fromNumber(Number.isFinite(value) ? value : 0);
}

/** An event with the defaults the RPE validator and runtime expect. */
export function makeEvent(
  startBeat: number,
  endBeat: number,
  start: number,
  end: number,
  easingType = 1,
): JudgeLineEvent {
  return {
    startTime: beatFromNumber(startBeat),
    endTime: beatFromNumber(endBeat),
    start,
    end,
    easingType,
    easingLeft: 0,
    easingRight: 1,
    bezier: 0,
    bezierPoints: [...DEFAULT_BEZIER_POINTS],
    linkgroup: 0,
  };
}

/** A note with every field the RPE writers write. */
export function makeNote(
  type: number,
  startBeat: number,
  endBeat: number,
  positionX: number,
  above: number,
  speed = 1,
  size = 1,
  isFake = 0,
): JudgeLineNote {
  return {
    type,
    startTime: beatFromNumber(startBeat),
    endTime: beatFromNumber(type === 2 ? endBeat : startBeat),
    positionX,
    above,
    isFake,
    speed,
    size,
    yOffset: 0,
    visibleTime: 999999,
    alpha: 255,
  };
}

/** An empty five-track layer for a line that will be filled by a parser. */
export function emptyLayer(): LineEventLayer {
  return {
    moveXEvents: [],
    moveYEvents: [],
    rotateEvents: [],
    alphaEvents: [],
    speedEvents: [],
  };
}

/** A complete line shell with the defaults RPE expects. */
export function makeLine(name: string, index: number, layer: LineEventLayer): JudgeLine {
  return {
    Name: name,
    Group: 0,
    Texture: "line.png",
    bpmfactor: 1,
    father: NO_LINE_PARENT,
    rotateWithFather: false,
    isCover: 1,
    zOrder: importedLineZOrder(index),
    anchor: [0.5, 0.5],
    isGif: false,
    eventLayers: [layer],
    extended: {},
    notes: [],
    numOfNotes: 0,
  };
}

/** Fill a line's note tally from its notes. */
export function updateNoteCount(line: JudgeLine): void {
  line.numOfNotes = countScoringNotes(line.notes);
}

/** Metadata for a chart whose source has no META block. */
export function makeMeta(metadata: ExternalChartMetadata, offsetMs: number): ChartMeta {
  return {
    RPEVersion: CURRENT_RPE_VERSION,
    name: metadata.name ?? "",
    composer: metadata.composer ?? "",
    charter: metadata.charter ?? "",
    illustrator: metadata.illustrator ?? "",
    level: metadata.level ?? "",
    song: metadata.song ?? "",
    background: metadata.background ?? "",
    offset: roundNumber(offsetMs, 6),
  };
}

/** A minimal valid chart root for an imported format. */
export function makeChart(
  metadata: ExternalChartMetadata,
  bpm: number,
  offsetMs: number,
  lines: JudgeLine[],
): Chart {
  return {
    META: makeMeta(metadata, offsetMs),
    BPMList: [{ bpm: roundNumber(positiveNumber(bpm, 120), 6), startTime: [0, 0, 1] }],
    judgeLineGroup: ["Default"],
    judgeLineList: lines,
  };
}

/** True when an object carries the shape of an RPE chart. */
export function looksLikeRpeChart(value: unknown): boolean {
  return isRecord(value) && isRecord(value.META) && Array.isArray(value.BPMList);
}

/** True when an object carries the shape of an official Phigros chart. */
export function looksLikeOfficialChart(value: unknown): boolean {
  return (
    isRecord(value) &&
    Array.isArray(value.judgeLineList) &&
    (typeof value.formatVersion === "number" || typeof value.formatVersion === "string") &&
    !isRecord(value.META)
  );
}
