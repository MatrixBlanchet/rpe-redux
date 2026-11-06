/**
 * Pure bulk edits that give a whole folder one judge-line purpose.
 *
 * A folder selection has no single line to inspect, so the panel applies one
 * target purpose to every line in the folder. This module owns the decisions:
 * which conflicts must be cleared, which lines a target cannot touch, and which
 * noise lines cannot be projected for export. The controller owns confirmation,
 * history labels, and notifications; this module never mutates its input chart.
 */
import type { Chart, JudgeLine } from "../chart.ts";
import { lineNoiseConflicts, type LineNoiseConflicts } from "../noise/lineNoiseConflicts.ts";
import { noiseAreaForLine, noiseLineSettings, setNoiseLineMode } from "../noise/noiseLine.ts";
import { TempoMap } from "../timing/tempo.ts";

/** The purpose a folder batch writes to every eligible line. */
export type LinePurposeTarget = "standard" | "noise" | "inverted";

/** Why one line kept its current purpose. */
export type LinePurposeSkipReason = "text" | "unsupported";

/** One line the batch left untouched. */
export interface LinePurposeSkip {
  index: number;
  reason: LinePurposeSkipReason;
}

/** Aggregated content that a confirmed batch will clear. */
export interface LinePurposeConflicts {
  /** Distinct lines that carry any of the content below. */
  lines: number;
  notes: number;
  alphaEvents: number;
  speedEvents: number;
  /** Custom textures, one per line. */
  textures: number;
  /** Lines whose standard purpose carries a UI binding. */
  uiBindings: number;
  /** Lines that are currently noise areas. */
  noiseSettings: number;
}

/** The result of one folder purpose edit. */
export interface LinePurposeEdit {
  /** The new chart, or the input chart when nothing changed. */
  chart: Chart;
  /** Line indices whose purpose changed. */
  changed: readonly number[];
  /** Lines that kept their old purpose, with the reason. */
  skipped: readonly LinePurposeSkip[];
  /** Content the confirmed edit removes. */
  conflicts: LinePurposeConflicts;
}

const DEFAULT_TEXTURE = "line.png";

/** A line with text events is a label, not a judge line with a switchable purpose. */
function isTextLine(line: JudgeLine): boolean {
  return Boolean(line.extended?.textEvents?.length);
}

/** True when the line draws a custom image instead of the default line texture. */
function hasCustomTexture(line: JudgeLine): boolean {
  const texture = String(line.Texture ?? "").trim();
  return Boolean(texture && texture !== DEFAULT_TEXTURE);
}

/** Explicit standard intent: no noise settings, default texture, no UI binding. */
function asStandardLine(line: JudgeLine): JudgeLine {
  const noise = noiseLineSettings(line) !== null;
  const texture = hasCustomTexture(line);
  const uiBinding = Boolean(line.attachUI);
  if (!noise && !texture && !uiBinding) {
    return line;
  }
  let next = noise ? setNoiseLineMode(line, "off") : line;
  if (texture) {
    next = { ...next, Texture: DEFAULT_TEXTURE };
  }
  if (uiBinding) {
    const copy = { ...next };
    delete copy.attachUI;
    next = copy;
  }
  return next;
}

/** Empty counters for a batch that clears nothing. */
function emptyConflicts(): LinePurposeConflicts {
  return {
    lines: 0,
    notes: 0,
    alphaEvents: 0,
    speedEvents: 0,
    textures: 0,
    uiBindings: 0,
    noiseSettings: 0,
  };
}

/** Add one line's incompatible content to the batch totals. */
function addConflicts(
  totals: LinePurposeConflicts,
  conflicts: LineNoiseConflicts,
  line: JudgeLine,
  affected: Set<number>,
  index: number,
): LinePurposeConflicts {
  if (conflicts.notes || conflicts.alphaEvents || conflicts.speedEvents || conflicts.textures) {
    affected.add(index);
  }
  return {
    lines: totals.lines,
    notes: totals.notes + conflicts.notes,
    alphaEvents: totals.alphaEvents + conflicts.alphaEvents,
    speedEvents: totals.speedEvents + conflicts.speedEvents,
    textures: totals.textures + conflicts.textures,
    uiBindings: totals.uiBindings,
    noiseSettings: totals.noiseSettings + (noiseLineSettings(line) !== null ? 1 : 0),
  };
}

/**
 * Apply one target purpose to the lines at `indices`.
 *
 * Text lines are never converted. Switching to noise clears notes, opacity and
 * speed events, and custom textures, then verifies that the resulting area can
 * be exported; a line that cannot be projected is restored and reported as
 * unsupported instead of aborting the batch. Invalid and duplicate indices are
 * ignored. The input chart is not modified.
 */
export function applyLinePurpose(
  chart: Chart,
  indices: readonly number[],
  target: LinePurposeTarget,
): LinePurposeEdit {
  const sourceLines = chart.judgeLineList ?? [];
  const targets = [...new Set(indices)]
    .filter((index) => Number.isInteger(index) && index >= 0 && index < sourceLines.length)
    .sort((left, right) => left - right);
  if (!targets.length) {
    return { chart, changed: [], skipped: [], conflicts: emptyConflicts() };
  }
  const nextLines = [...sourceLines];
  const changed: number[] = [];
  const skipped: LinePurposeSkip[] = [];
  const affected = new Set<number>();
  let totals = emptyConflicts();

  for (const index of targets) {
    const line = sourceLines[index];
    if (isTextLine(line)) {
      skipped.push({ index, reason: "text" });
      continue;
    }
    if (target === "standard") {
      if (noiseLineSettings(line) !== null) {
        affected.add(index);
        totals = { ...totals, noiseSettings: totals.noiseSettings + 1 };
      }
      if (hasCustomTexture(line)) {
        affected.add(index);
        totals = { ...totals, textures: totals.textures + 1 };
      }
      if (line.attachUI) {
        affected.add(index);
        totals = { ...totals, uiBindings: totals.uiBindings + 1 };
      }
      const next = asStandardLine(line);
      if (next !== line) {
        nextLines[index] = next;
        changed.push(index);
      }
      continue;
    }

    const conflicts = lineNoiseConflicts(line);
    totals = addConflicts(totals, conflicts, line, affected, index);
    const settings = noiseLineSettings(line);
    const mode = target === "inverted" ? "inverted" : "normal";
    const alreadyTarget = settings?.invert === (target === "inverted");
    const clean =
      !conflicts.notes && !conflicts.alphaEvents && !conflicts.speedEvents && !conflicts.textures;
    if (alreadyTarget && clean) {
      continue;
    }
    try {
      nextLines[index] = setNoiseLineMode(line, mode, true);
      changed.push(index);
    } catch {
      skipped.push({ index, reason: "unsupported" });
    }
  }

  if (target !== "standard" && changed.length) {
    const candidate: Chart = { ...chart, judgeLineList: nextLines };
    const tempo = new TempoMap(chart.BPMList);
    const supported: number[] = [];
    for (const index of changed) {
      try {
        noiseAreaForLine(nextLines[index], tempo, candidate);
        supported.push(index);
      } catch {
        nextLines[index] = sourceLines[index];
        skipped.push({ index, reason: "unsupported" });
      }
    }
    const supportedSet = new Set(supported);
    const kept = changed.filter((index) => supportedSet.has(index));
    changed.length = 0;
    changed.push(...kept);
    skipped.sort((left, right) => left.index - right.index);
  }

  totals = {
    ...totals,
    lines: affected.size,
  };
  return {
    chart: changed.length ? { ...chart, judgeLineList: nextLines } : chart,
    changed,
    skipped,
    conflicts: totals,
  };
}
