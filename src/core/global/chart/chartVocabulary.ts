/**
 * The chart format's track and note vocabularies.
 *
 * These constants are the shared words of a chart document: which event tracks
 * exist and which note types the format defines. They live apart from the model
 * so validation and editing modules can use them without importing the model
 * itself.
 */

/** Ordinary event tracks stored on every line layer. */
export const EVENT_TYPES = [
  "moveXEvents",
  "moveYEvents",
  "rotateEvents",
  "alphaEvents",
  "speedEvents",
] as const;

/** Base event-layer count before the editor's synthetic extended layer. */
export const MAX_BASE_EVENT_LAYERS = 4;

/** Extended event tracks beyond the five ordinary layer tracks. */
export const EXTENDED_TYPES = [
  "scaleXEvents",
  "scaleYEvents",
  "colorEvents",
  "paintEvents",
  "textEvents",
  "inclineEvents",
  "gifEvents",
] as const;

/** Every event track stored on a line, including the extended/shader tracks. */
export const EVENT_TRACKS = [...EVENT_TYPES, ...EXTENDED_TYPES] as const;

export type EventTrackName = (typeof EVENT_TRACKS)[number];

/** The tracks stored under `judgeLine.extended` (plus shader payloads). */
export type ExtendedType = (typeof EXTENDED_TYPES)[number];

/** True for a track name owned by either event layer or the extended map. */
export function isEventTrack(value: unknown): value is EventTrackName {
  return typeof value === "string" && (EVENT_TRACKS as readonly string[]).includes(value);
}

/** Note types the chart format defines: Tap, Hold, Drag and Flick. */
export const NOTE_TYPES = [1, 2, 3, 4] as const;

export type NoteType = (typeof NOTE_TYPES)[number];

/** True when `value` is one of the four supported note types. */
export function isNoteType(value: unknown): value is NoteType {
  return typeof value === "number" && NOTE_TYPES.includes(value as NoteType);
}
