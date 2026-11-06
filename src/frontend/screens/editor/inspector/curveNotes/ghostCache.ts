/**
 * Caches the timeline ghost notes produced by the curve editor.
 *
 * The timeline repaints on every playback frame, so the ghost must be built only
 * when a curve input changes. The key combines the draft values, the anchors'
 * presence, the grid division, and a fingerprint of the chart note list.
 */
import {
  buildCurveGhostNotes,
  type CurveGhostValues,
} from "../../../../../core/edit/timeline/curveGhost.ts";
import { curveNoteListToken } from "../../../../../core/global/chart/editing/curveNotes.ts";
import type { CurveAnchor, TimelineNote } from "../../../../../core/edit/timeline/types.ts";
import type { JudgeLineNote } from "../../../../../core/global/chart/chart.ts";

/** One ghost build request; every field participates in the cache key. */
export interface CurveGhostCacheInput {
  active: boolean;
  start: CurveAnchor | null | undefined;
  end: CurveAnchor | null | undefined;
  values: CurveGhostValues;
  division: number;
  notes: readonly JudgeLineNote[];
  onError?: (error: unknown) => void;
}

/** Cache counters for tests and diagnostics. */
export interface CurveGhostCacheStats {
  hits: number;
  misses: number;
  entries: number;
}

interface CachedGhost {
  key: string;
  notes: TimelineNote[];
  /** A generation failure retained so a cache hit can still report it. */
  error: unknown;
}

/** Build the cache key from every input the ghost builder reads. */
function ghostKey(input: CurveGhostCacheInput): string {
  const { values } = input;
  return [
    input.active ? 1 : 0,
    input.start ? 1 : 0,
    input.end ? 1 : 0,
    values.startTime.join("/"),
    values.endTime.join("/"),
    values.startX,
    values.endX,
    values.type,
    values.density,
    values.easingType,
    input.division,
    curveNoteListToken(input.notes),
  ].join("|");
}

/** Creates a last-result cache bound to one curve editor instance. */
export function createCurveGhostCache() {
  let cached: CachedGhost | null = null;
  let hits = 0;
  let misses = 0;

  return {
    /** Return the ghost for these inputs, reusing the last identical build. */
    get(input: CurveGhostCacheInput): TimelineNote[] {
      const key = ghostKey(input);
      if (cached?.key === key) {
        hits += 1;
        if (cached.error !== null) {
          try {
            input.onError?.(cached.error);
          } catch {
            // Reporting is isolated so a cached preview failure stays a preview failure.
          }
        }
        return cached.notes;
      }
      misses += 1;
      let error: unknown = null;
      const notes = buildCurveGhostNotes(
        input.active,
        input.start,
        input.end,
        input.values,
        input.division,
        input.notes,
        (failure) => {
          error = failure;
          input.onError?.(failure);
        },
      );
      cached = { key, notes, error };
      return notes;
    },
    /** Drop the cached ghost after a draft, preview, or anchor change. */
    invalidate(): void {
      cached = null;
    },
    /** Report cache counters for tests and diagnostics. */
    stats(): CurveGhostCacheStats {
      return { hits, misses, entries: cached ? 1 : 0 };
    },
  };
}
