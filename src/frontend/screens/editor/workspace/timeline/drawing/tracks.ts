/**
 * Fixed event-track definitions for the timeline: the special track keys, their
 * localized labels, and the base layer count shared with the layer buttons.
 *
 * Labels resolve through i18n at call time rather than being frozen at import.
 */
import { t, type MessageKey } from "../../../../../../i18n/index.ts";
import { EVENT_TYPES, type JudgeLine } from "../../../../../../core/global/chart/chart.ts";
import { MAX_BASE_EVENT_LAYERS } from "../../../../../../core/global/chart/chartVocabulary.ts";
import { noiseLineSettings } from "../../../../../../core/global/chart/noise/noiseLine.ts";
import { NOISE_ACTIVE_EVENTS } from "../../../../../../core/edit/events/eventTracks.ts";
import type { ExtendedType } from "../../../../../../core/global/chart/chart.ts";

/** Special event tracks and their localized display labels. */
export const SPECIAL_TRACKS: { key: ExtendedType; label: MessageKey }[] = [
  { key: "scaleXEvents", label: "editor.display.editorDisplay.trackScaleX" },
  { key: "scaleYEvents", label: "editor.display.editorDisplay.trackScaleY" },
  { key: "colorEvents", label: "editor.display.editorDisplay.trackColor" },
  { key: "paintEvents", label: "editor.display.editorDisplay.trackShader" },
  { key: "textEvents", label: "editor.display.editorDisplay.trackText" },
];

/** Resolve one special track's label in the active language. */
export function specialTrackLabel(track: { label: MessageKey }): string {
  return t(track.label);
}

/** Base event layers before the synthetic extended layer. */
export const MAX_BASE_LAYERS = MAX_BASE_EVENT_LAYERS;

/** Numeric event layer that selects the synthetic extended event map. */
export const EXTENDED_EVENT_LAYER = MAX_BASE_LAYERS;

/** Track geometry follows the line shown in each individual panel. */
export function eventTypesForLine(line: JudgeLine | undefined, extended: boolean): string[] {
  if (extended) {
    return SPECIAL_TRACKS.map((track) => track.key);
  }
  return noiseLineSettings(line)
    ? [
        "moveXEvents",
        "moveYEvents",
        "rotateEvents",
        "scaleXEvents",
        "scaleYEvents",
        NOISE_ACTIVE_EVENTS,
      ]
    : [...EVENT_TYPES];
}

/** Resolve a panel-local pointer to the displayed event track. */
export function eventTypeAt(
  types: readonly string[],
  x: number,
  contentWidth: number,
): string | undefined {
  if (!types.length) {
    return undefined;
  }
  const channel = Math.max(
    0,
    Math.min(types.length - 1, Math.floor(x / (Math.max(1, contentWidth) / types.length))),
  );
  return types[channel];
}
