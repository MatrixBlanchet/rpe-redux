/**
 * Completion-time cache for the preview score/combo readout.
 *
 * A line's sorted completion times only depend on that line's note entries and
 * the tempo source. Edits usually replace one line, so caching per line avoids
 * filtering, mapping, and sorting every note in the chart on each commit.
 */
import type { JudgeLineNote } from "../../../../../../core/global/chart/chart.ts";
import type { NoteEntry } from "../../../../../../core/global/chart/runtime/scene.ts";
import type { TempoSource } from "../../../../../../core/global/chart/timing/events.ts";

/** Sorted score-completion times for one line's compiled note entries. */
export function completionTimesForEntries(entries: readonly NoteEntry[]): number[] {
  const times: number[] = [];
  for (const entry of entries) {
    if (entry.note.isFake) {
      continue;
    }
    times.push(entry.note.type === 2 ? entry.end : entry.start);
  }
  return times.sort((left, right) => left - right);
}

/** Merge already-sorted completion-time arrays into one sorted array. */
export function mergeCompletionTimes(parts: readonly (readonly number[])[]): number[] {
  if (parts.length === 0) {
    return [];
  }
  if (parts.length === 1) {
    return [...parts[0]];
  }
  let total = 0;
  for (const part of parts) {
    total += part.length;
  }
  const merged = new Array<number>(total);
  const indices = new Uint32Array(parts.length);
  for (let output = 0; output < total; output += 1) {
    let best = -1;
    let bestValue = Number.POSITIVE_INFINITY;
    for (let part = 0; part < parts.length; part += 1) {
      const index = indices[part];
      if (index >= parts[part].length) {
        continue;
      }
      const value = parts[part][index];
      if (value < bestValue) {
        best = part;
        bestValue = value;
      }
    }
    merged[output] = bestValue;
    indices[best] += 1;
  }
  return merged;
}

/** Per-line completion-time cache, rebuilt only for lines whose notes changed. */
export class CompletionTimesCache {
  private tempo: TempoSource | null = null;
  private sources: readonly (readonly JudgeLineNote[] | undefined)[] = [];
  private lineTimes: number[][] = [];
  private merged: number[] = [];

  /** Recompute changed lines and merge their sorted completion times. */
  update(
    lines: readonly { readonly notes: readonly NoteEntry[] }[],
    sources: readonly (readonly JudgeLineNote[] | undefined)[],
    tempo: TempoSource,
  ): number[] {
    const tempoChanged = this.tempo !== tempo;
    if (tempoChanged) {
      this.sources = [];
      this.lineTimes = [];
      this.tempo = tempo;
    }
    const previousSources = this.sources;
    let changed = tempoChanged || previousSources.length !== lines.length;
    if (this.lineTimes.length !== lines.length) {
      this.lineTimes.length = lines.length;
    }
    for (let index = 0; index < lines.length; index += 1) {
      if (tempoChanged || previousSources[index] !== sources[index] || !this.lineTimes[index]) {
        this.lineTimes[index] = completionTimesForEntries(lines[index]?.notes ?? []);
        changed = true;
      }
    }
    this.sources = sources;
    if (!changed && this.merged.length) {
      return this.merged;
    }
    this.merged = mergeCompletionTimes(this.lineTimes);
    return this.merged;
  }

  /** Drop every line result when the document closes. */
  clear(): void {
    this.tempo = null;
    this.sources = [];
    this.lineTimes = [];
    this.merged = [];
  }
}
