/**
 * Content-based detection for the chart formats this editor can import from
 * outside RPE.
 *
 * Extensions are not enough: Re:PhiEdit exports old PEC text inside `.json`, and
 * official charts are also `.json`. The parser therefore inspects the root shape
 * for JSON and the command vocabulary for PEC, and returns null for an ordinary
 * RPE chart so the native document path keeps owning it.
 */
import type { Chart } from "../chart.ts";
import { isRecord } from "../../../utils/guards.ts";
import { looksLikeOfficialChart, looksLikeRpeChart, type ExternalChartMetadata } from "./common.ts";
import { parseOfficialChart } from "./official.ts";
import { looksLikePecChart, parsePecChart } from "./pec.ts";

/** The external formats the editor can convert into an RPE chart. */
export type ExternalChartFormat = "official" | "pec";

/** A converted external chart with its detected format. */
export interface ParsedExternalChart {
  format: ExternalChartFormat;
  chart: Chart;
  warnings: string[];
}

/**
 * Convert a chart text when it is an official or PEC chart.
 *
 * Returns null for a valid RPE chart, which the existing native open/import
 * path must handle, and for text that does not match a supported format.
 */
export function parseExternalChartText(
  text: string,
  metadata: ExternalChartMetadata = {},
): ParsedExternalChart | null {
  const trimmed = text.replace(/^\uFEFF/, "").trimStart();
  if (trimmed.startsWith("{")) {
    let value: unknown;
    try {
      value = JSON.parse(trimmed);
    } catch {
      return null;
    }
    if (looksLikeRpeChart(value)) {
      return null;
    }
    if (looksLikeOfficialChart(value)) {
      const converted = parseOfficialChart(value, metadata);
      return { format: "official", ...converted };
    }
    return null;
  }
  if (trimmed.startsWith("[") || !looksLikePecChart(trimmed)) {
    return null;
  }
  const converted = parsePecChart(trimmed, metadata);
  return { format: "pec", ...converted };
}

/** Detect an external chart format without exposing the converted chart. */
export function detectExternalChartText(
  text: string,
  metadata: ExternalChartMetadata = {},
): ExternalChartFormat | null {
  return parseExternalChartText(text, metadata)?.format ?? null;
}

/** True when a JSON value is an official chart object. */
export function isOfficialChartValue(value: unknown): boolean {
  return isRecord(value) && looksLikeOfficialChart(value);
}
