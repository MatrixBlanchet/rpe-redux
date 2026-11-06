/**
 * Owns the chart-runtime rule that turns completed note times into combo and
 * score values. It accepts ordered numeric data only; preview rendering and
 * HUD layout stay in `frontend/screens/editor/workspace/preview/`.
 *
 * Example: `scoreAt([1, 2, 4], 2.5)` returns `{ combo: 2, score: 666667 }`.
 */
import { lowerBound } from "../../../utils/search.ts";

/**
 * Counts completions strictly earlier than playback time and derives the
 * million-point score used by the chart runtime.
 */
export function scoreAt(completionTimes: readonly number[], seconds: number) {
  const combo = lowerBound(completionTimes, seconds);
  return {
    combo,
    score: completionTimes.length ? Math.round((1000000 * combo) / completionTimes.length) : 0,
  };
}
