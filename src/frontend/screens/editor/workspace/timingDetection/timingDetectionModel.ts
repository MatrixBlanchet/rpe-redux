/**
 * Pure view and apply rules for the fixed-BPM timing detector.
 *
 * The detector always answers with one BPM and a confidence. This module turns
 * that confidence into a display percentage, decides when the dialog warns
 * about a weak pulse, parses the two editable fields, and builds the fixed
 * timing chart the host commits. Keeping those rules here lets the React
 * surfaces stay thin and makes the behaviour testable without a DOM.
 */
import type { Chart } from "../../../../../core/global/chart/chart.ts";
import { chartWithDetectedTiming } from "../../../../../core/global/chart/editing/drafts.ts";

/** Detector confidence below this reads as "no clear pulse". */
export const LOW_CONFIDENCE_THRESHOLD = 0.4;

/** The action that applies a fixed BPM to the current chart. */
export type TimingApplyLabelKey =
  "editorPanels.timingDetection.apply" | "editorPanels.timingDetection.replaceAndApply";

/** Clamp a confidence into a whole percentage for display. */
export function confidencePercent(confidence: number): number {
  const value = Number.isFinite(confidence) ? confidence : 0;
  return Math.round(Math.max(0, Math.min(1, value)) * 100);
}

/** Whether the dialog should warn that the detected pulse is weak. */
export function isLowConfidence(confidence: number): boolean {
  return !(confidence >= LOW_CONFIDENCE_THRESHOLD);
}

/** One validated BPM/offset pair from the dialog fields. */
export interface TimingDraft {
  bpm: number;
  offsetMs: number;
}

/** Parse the editable BPM and offset, or null when either is unusable. */
export function parseTimingDraft(bpm: string, offset: string): TimingDraft | null {
  if (bpm.trim() === "" || offset.trim() === "") {
    return null;
  }
  const nextBpm = Number(bpm);
  const nextOffset = Number(offset);
  if (!(nextBpm > 0) || !Number.isFinite(nextBpm) || !Number.isFinite(nextOffset)) {
    return null;
  }
  return { bpm: nextBpm, offsetMs: nextOffset };
}

/** The chart and seek time produced by applying the fixed timing. */
export interface TimingApplication {
  chart: Chart;
  seekMs: number;
}

/** Build the fixed-BPM chart; null when the editable fields are invalid. */
export function applyDetectedTiming(
  chart: Chart,
  bpm: string,
  offset: string,
): TimingApplication | null {
  const draft = parseTimingDraft(bpm, offset);
  if (!draft) {
    return null;
  }
  return {
    chart: chartWithDetectedTiming(chart, draft.bpm, draft.offsetMs),
    seekMs: draft.offsetMs,
  };
}

/** Pick the button copy that matches the chart the application replaces. */
export function applyTimingLabelKey(chart: Chart | null): TimingApplyLabelKey {
  return chart && chart.BPMList.length > 1
    ? "editorPanels.timingDetection.replaceAndApply"
    : "editorPanels.timingDetection.apply";
}
