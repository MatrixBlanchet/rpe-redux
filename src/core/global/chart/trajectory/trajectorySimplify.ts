/**
 * Splits sampled trajectory points into eased pieces the event format can store.
 *
 * Owns split defaults, input validation and piece fitting; callers keep the chart
 * mutation and choose how many segments to request.
 */
import { easing } from "../../../utils/easing.ts";
import { trajectoryError } from "./errorContract.ts";

/** Split behaviour: whether to fit eased pieces and the allowed error. */
export interface TrajectorySplitSettings {
  simplify: boolean;
  tolerance: number;
}

/** The split options a caller may supply; every field is validated and defaulted. */
export interface TrajectorySplitInput {
  simplify?: boolean;
  tolerance?: number;
}

/** Default split settings: simplify with a one-unit tolerance. */
export const DEFAULT_TRAJECTORY_SPLIT: TrajectorySplitSettings = Object.freeze({
  simplify: true,
  tolerance: 1,
});

/** Validate caller options and fill the defaults; throws `invalidTolerance`. */
export function trajectorySplitSettings(value: TrajectorySplitInput = {}): TrajectorySplitSettings {
  const settings: TrajectorySplitSettings = { ...DEFAULT_TRAJECTORY_SPLIT, ...value };
  if (
    typeof settings.simplify !== "boolean" ||
    !Number.isFinite(settings.tolerance) ||
    settings.tolerance <= 0 ||
    settings.tolerance > 10000
  ) {
    throw trajectoryError("invalidTolerance");
  }
  return settings;
}

/** One fitted piece of a sampled trajectory: `[first, last]` plus the easing family. */
export interface TrajectoryPiece {
  first: number;
  last: number;
  easingType: number;
}

/**
 * Fit sampled values to the fewest eased pieces within `tolerance`.
 *
 * Pieces are split at midpoints until an easing fits; throws `invalidFitInput`
 * when the sample count, values or tolerance are unusable.
 */
export function simplifyTrajectorySamples(
  values: readonly number[],
  tolerance: number,
): TrajectoryPiece[] {
  if (
    values.length < 2 ||
    !values.every(Number.isFinite) ||
    !Number.isFinite(tolerance) ||
    tolerance <= 0
  ) {
    throw trajectoryError("invalidFitInput");
  }
  const pieces: TrajectoryPiece[] = [];
  const pending: [number, number][] = [[0, values.length - 1]];
  // True when one easing family stays within tolerance across an index range.
  const fits = (first: number, last: number, type: number): boolean => {
    const count = last - first;
    const initial = values[first];
    const change = values[last] - initial;
    const at = (progress: number) => initial + change * easing(progress, type);
    for (let index = first + 1; index < last; index++) {
      if (Math.abs(at((index - first) / count) - values[index]) > tolerance) {
        return false;
      }
    }
    if (type === 1) {
      return true;
    }
    // Check an eased span against the sampled points it covers by bisection.
    const bounded = (
      left: number,
      right: number,
      start: number,
      end: number,
      depth: number,
    ): boolean => {
      const firstValue = at(left);
      const lastValue = at(right);
      if (
        Math.max(
          Math.abs(firstValue - end),
          Math.abs(lastValue - start),
          Math.abs(firstValue - start),
          Math.abs(lastValue - end),
        ) <= tolerance
      ) {
        return true;
      }
      const middle = (left + right) / 2;
      const value = (start + end) / 2;
      if (depth === 0 || Math.abs(at(middle) - value) > tolerance) {
        return false;
      }
      return (
        bounded(left, middle, start, value, depth - 1) &&
        bounded(middle, right, value, end, depth - 1)
      );
    };
    for (let index = first; index < last; index++) {
      if (
        !bounded(
          (index - first) / count,
          (index + 1 - first) / count,
          values[index],
          values[index + 1],
          12,
        )
      ) {
        return false;
      }
    }
    return true;
  };
  while (pending.length) {
    const range = pending.pop();
    if (!range) {
      break;
    }
    const [first, last] = range;
    let type = 1;
    for (; type <= 19; type++) {
      if (fits(first, last, type)) {
        break;
      }
    }
    if (type <= 19) {
      pieces.push({ first, last, easingType: type });
    } else {
      const middle = Math.floor((first + last) / 2);
      pending.push([middle, last], [first, middle]);
    }
  }
  return pieces;
}
