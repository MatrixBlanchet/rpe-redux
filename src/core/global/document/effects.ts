/**
 * Attaches an external `extra.json` effects list to opened candidates.
 *
 * A candidate without its own `effects` adopts the sidecar from the same directory,
 * or the single unambiguous sidecar when one chart was dropped with one file.
 */
import { decodeChartText } from "../../utils/text.ts";
import type { OpenCandidate } from "./types.ts";

/**
 * Adopt an external `extra.json` effects list for candidates that define none.
 *
 * A sidecar in the chart's directory wins; a single chart opened with a single
 * sidecar may fall back to that sidecar. Unreadable or unrelated files are
 * skipped.
 */
export function attachExternalEffects(
  candidates: OpenCandidate[],
  assets: ReadonlyMap<string, Uint8Array>,
): void {
  const extras = [...assets.entries()].filter(
    ([name]) => name.replaceAll("\\", "/").split("/").at(-1)?.toLowerCase() === "extra.json",
  );
  for (const candidate of candidates) {
    if (Array.isArray(candidate.chart.effects)) {
      continue;
    }
    const chartDirectory = candidate.name
      .replaceAll("\\", "/")
      .split("/")
      .slice(0, -1)
      .join("/")
      .toLowerCase();
    const matches = extras.filter(
      ([name]) =>
        name.replaceAll("\\", "/").split("/").slice(0, -1).join("/").toLowerCase() ===
        chartDirectory,
    );
    const fallback = matches.length
      ? matches
      : candidates.length === 1 && extras.length === 1
        ? extras
        : [];
    for (const [, bytes] of fallback) {
      try {
        const extra = JSON.parse(decodeChartText(bytes));
        if (Array.isArray(extra.effects)) {
          candidate.chart.effects = extra.effects;
          break;
        }
      } catch {
        /* Skip files that are not a readable effects sidecar. */
      }
    }
  }
}
