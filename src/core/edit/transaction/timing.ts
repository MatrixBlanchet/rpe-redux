/**
 * Owns the `timing` transaction section.
 *
 * A timing transaction replaces the complete tempo map, validates each point
 * with a path-specific issue, and stores the entries sorted by beat so the
 * editor's in-order BPM readers agree with the tempo map used for playback.
 */
import type { BpmEntry, Chart } from "../../global/chart/chart.ts";
import { beatValue, isBeat } from "../../global/chart/timing/beat.ts";
import { isRecord } from "../../utils/guards.ts";
import type { TransactionIssue } from "./contract.ts";

/** One transaction issue with only the code and path needed by timing edits. */
function issue(code: string, path: string): TransactionIssue {
  return Object.freeze({ code, path });
}

/**
 * Replace `chart.BPMList` from the transaction's `timing` section.
 *
 * An invalid section leaves the chart untouched and appends one issue per
 * offending point, matching the rest of the apply kernel's partial-failure
 * reporting.
 */
export function applyTiming(chart: Chart, timing: unknown, issues: TransactionIssue[]): void {
  if (!isRecord(timing)) {
    issues.push(issue("timing.object.required", "timing"));
    return;
  }
  if (!Array.isArray(timing.bpmList)) {
    issues.push(issue("timing.bpmList.required", "timing.bpmList"));
    return;
  }
  if (!timing.bpmList.length) {
    issues.push(issue("timing.bpmList.empty", "timing.bpmList"));
    return;
  }
  const entries: BpmEntry[] = [];
  for (const [index, value] of timing.bpmList.entries()) {
    const path = `timing.bpmList[${index}]`;
    if (!isRecord(value)) {
      issues.push(issue("timing.bpm.entry.required", path));
      continue;
    }
    if (typeof value.bpm !== "number" || !Number.isFinite(value.bpm) || value.bpm <= 0) {
      issues.push(issue("timing.bpm.invalid", `${path}.bpm`));
      continue;
    }
    if (!isBeat(value.startTime)) {
      issues.push(issue("timing.bpm.startTime.invalid", `${path}.startTime`));
      continue;
    }
    try {
      entries.push(structuredClone(value) as BpmEntry);
    } catch {
      issues.push(issue("timing.bpm.entry.uncloneable", path));
    }
  }
  if (entries.length !== timing.bpmList.length) {
    return;
  }
  entries.sort((left, right) => beatValue(left.startTime) - beatValue(right.startTime));
  chart.BPMList = entries;
}
