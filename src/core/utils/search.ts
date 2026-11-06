// Generic binary search over a sorted `ArrayLike`. Both return an insertion point,
// not a found/not-found flag: `lowerBound` is the first index whose key is `>= target`,
// `upperBound` the first whose key is `> target`.

/** First index whose key is `>= target`. Returns `values.length` when every key is smaller. */
export function lowerBound<T>(
  values: ArrayLike<T>,
  target: number,
  key: (value: T) => number,
): number;
export function lowerBound(values: ArrayLike<number>, target: number): number;
export function lowerBound<T>(
  values: ArrayLike<T>,
  target: number,
  key: (value: T) => number = (value) => value as number,
): number {
  let low = 0,
    high = values.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (key(values[middle]) < target) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }
  return low;
}

/** First index whose key is `> target`. Returns `values.length` when every key is `<= target`. */
export function upperBound<T>(
  values: ArrayLike<T>,
  target: number,
  key: (value: T) => number,
): number;
export function upperBound(values: ArrayLike<number>, target: number): number;
export function upperBound<T>(
  values: ArrayLike<T>,
  target: number,
  key: (value: T) => number = (value) => value as number,
): number {
  let low = 0;
  let high = values.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (key(values[middle]) <= target) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }
  return low;
}
