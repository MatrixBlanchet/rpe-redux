/**
 * Finds a judge line a script may fill without disturbing authored content.
 *
 * A free line has no notes, no child lines, and only the event layer and events
 * that `createLine` produces. The comparison against a reference line keeps the
 * definition correct when default event values change; the caller still decides
 * which lines are reserved, such as the current selection.
 */
import {
  createLine,
  EVENT_TYPES,
  type Chart,
  type JudgeLine,
  type JudgeLineEvent,
} from "../../global/chart/chart.ts";

const referenceLayer = createLine("").eventLayers?.[0];

/** Deep equality for arrays, plain objects, and primitives. */
function sameValue(left: unknown, right: unknown): boolean {
  if (left === right) {
    return true;
  }
  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((value, index) => sameValue(value, right[index]))
    );
  }
  if (left && right && typeof left === "object" && typeof right === "object") {
    return JSON.stringify(left) === JSON.stringify(right);
  }
  return false;
}

/** True when an event matches the template except for its id. */
function isDefaultEvent(event: JudgeLineEvent, expected: JudgeLineEvent | undefined): boolean {
  if (!expected) {
    return false;
  }
  const keys = new Set([...Object.keys(event), ...Object.keys(expected)]);
  keys.delete("id");
  for (const key of keys) {
    if (!sameValue(event[key], expected[key])) {
      return false;
    }
  }
  return true;
}

/** True when the line has one layer holding exactly the default event per type. */
function hasOnlyDefaultEvents(line: JudgeLine): boolean {
  const layers = line.eventLayers ?? [];
  if (layers.length !== 1 || !referenceLayer) {
    return false;
  }
  const layer = layers[0];
  if (!layer) {
    return false;
  }
  return EVENT_TYPES.every((type) => {
    const events = layer[type] ?? [];
    return events.length === 1 && isDefaultEvent(events[0], referenceLayer[type]?.[0]);
  });
}

/** True when any extended field carries a non-empty value. */
function hasExtendedContent(line: JudgeLine): boolean {
  return Object.values(line.extended ?? {}).some((value) => {
    if (Array.isArray(value)) {
      return value.length > 0;
    }
    return value !== undefined && value !== null && value !== "";
  });
}

/** True when another line names `index` as its parent. */
function hasChildLine(lines: readonly JudgeLine[], index: number): boolean {
  return lines.some((line, current) => current !== index && Number(line.father) === index);
}

/** Whether one line still contains nothing beyond the default template. */
export function isFreeJudgeLine(chart: Chart, index: number): boolean {
  const lines = chart.judgeLineList ?? [];
  const line = lines[index];
  return Boolean(
    line &&
    Number(line.father) < 0 &&
    (line.notes?.length ?? 0) === 0 &&
    !hasChildLine(lines, index) &&
    hasOnlyDefaultEvents(line) &&
    !hasExtendedContent(line),
  );
}

export interface FreeJudgeLineOptions {
  /** Lines that cannot be reused, typically the current line and other targets. */
  readonly exclude?: readonly number[];
  /** Prefer a scratch line with this name over an unrelated empty line. */
  readonly preferredName?: string;
}

/** The first reusable judge line, or null when every line has content. */
export function findFreeJudgeLine(chart: Chart, options: FreeJudgeLineOptions = {}): number | null {
  const lines = chart.judgeLineList ?? [];
  const blocked = new Set(options.exclude ?? []);
  let fallback: number | null = null;
  for (let index = 0; index < lines.length; index += 1) {
    if (blocked.has(index) || !isFreeJudgeLine(chart, index)) {
      continue;
    }
    if (options.preferredName && lines[index].Name === options.preferredName) {
      return index;
    }
    fallback ??= index;
  }
  return fallback;
}
