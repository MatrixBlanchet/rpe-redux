/**
 * Turns named chart entries into open candidates without touching platform state.
 *
 * Each entry is decoded and JSON-parsed once; diagnostics and the accepted chart
 * share that value. Invalid JSON is sanitized for read-only opening, and every
 * diagnostic path is prefixed with the entry name so a multi-chart archive
 * reports where it failed.
 */
import { parseChartValue, type Chart } from "../chart/chart.ts";
import { stripReduxExportVersion } from "../chart/exportProjection.ts";
import {
  parseChartDiagnostics,
  sanitizeChartForReadOnly,
  type ChartDiagnostic,
} from "../chart/diagnostics.ts";
import { t } from "../../../i18n/index.ts";
import { decodeChartText } from "../../utils/text.ts";
import type { OpenCandidate } from "./types.ts";

/** Charts parsed from a set of named entries, plus the failures alongside them. */
export interface ParsedChartEntries {
  candidates: OpenCandidate[];
  errors: string[];
  issues: ChartDiagnostic[];
}

/** Parses named chart entries; injectable so callers can wrap or defer parsing. */
export type ChartEntryParser = (
  entries: Iterable<[string, Uint8Array]>,
) => ParsedChartEntries | Promise<ParsedChartEntries>;

/**
 * Parse every JSON entry into an open candidate without touching platform or
 * editor state.
 *
 * Names failing validation are sanitized and marked read-only; their diagnostics
 * are prefixed with the entry name. Non-JSON entries are ignored.
 */
export function parseChartEntries(entries: Iterable<[string, Uint8Array]>): ParsedChartEntries {
  const candidates: OpenCandidate[] = [];
  const errors: string[] = [];
  const issues: ChartDiagnostic[] = [];
  for (const [name, bytes] of entries) {
    if (!/\.json$/i.test(name)) {
      continue;
    }
    try {
      const text = decodeChartText(bytes).replace(/^\uFEFF/, "");
      const parsed = parseChartDiagnostics(text);
      const value: Chart | null = parsed.issues.length
        ? sanitizeChartForReadOnly(parsed.value)
        : parseChartValue(parsed.value, text);
      if (!value) {
        errors.push(`${name}: ${t("model.chart.invalidDocument")}`);
        issues.push(...parsed.issues.map((entry) => ({ ...entry, path: `${name}:${entry.path}` })));
        continue;
      }
      // The export marker describes the file that was read, not the working
      // chart. Remove it before any caller fingerprints the parsed object.
      stripReduxExportVersion(value);
      candidates.push({
        name,
        chart: value,
        diagnostics: parsed.issues,
        readOnly: parsed.issues.length > 0,
      });
    } catch (error) {
      errors.push(`${name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return { candidates, errors, issues };
}
