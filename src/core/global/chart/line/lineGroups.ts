/**
 * Judge-line group lookup over `chart.judgeLineGroup` and each line's `Group` field.
 *
 * Names are trimmed, group index 0 is the fallback, and the helpers only read the
 * chart; renaming and reassignment belong to the editor surfaces.
 */
import type { Chart, JudgeLine } from "../chart.ts";

/** Declared group names, trimmed; an absent list reads as one unnamed group. */
export function groupNames(chart: Chart | undefined): string[] {
  // A missing field means one unnamed group; an explicit empty array means the
  // user removed every group and stays empty.
  if (!Array.isArray(chart?.judgeLineGroup)) {
    return [""];
  }
  return chart.judgeLineGroup.map((name) => String(name ?? "").trim());
}

/** The line's group index; invalid or missing values read as the default group 0. */
export function lineGroupIndex(line: JudgeLine | undefined): number {
  const value = Number(line?.Group ?? 0);
  return Number.isInteger(value) && value >= 0 ? value : 0;
}

/** Line indices belonging to `groupIndex`, in chart order. */
export function groupLineIndices(chart: Chart | undefined, groupIndex: number): number[] {
  return (chart?.judgeLineList ?? []).flatMap((line, index) =>
    lineGroupIndex(line) === groupIndex ? [index] : [],
  );
}
