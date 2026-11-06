/**
 * Group-row selection rule for the toolbar judge-line picker.
 *
 * A group row is a batch toggle: when the group is not fully selected, clicking
 * adds every line in it to the current selection; when it is fully selected,
 * clicking removes those lines again while leaving other groups untouched. The
 * picker supplies its active set (including a marquee preview) and commits the
 * result through its existing selection writer.
 */

/** Selection and focus produced by one group-row click. */
export interface GroupSelectionResult {
  /** Ascending, duplicate-free line indices. Empty only for a fully empty input. */
  selection: number[];
  /** The line to make current; a member of `selection` whenever it is non-empty. */
  focus: number;
}

/**
 * Toggle one group in the active selection.
 *
 * `selection` is the set currently painted (committed selection or marquee
 * preview). `activeLine` is the current `editor.line`; it becomes the focus when
 * it survives, otherwise the nearest surviving line does. Removing the last
 * selected group falls back to the active line, matching the picker's non-empty
 * invariant. Indices outside the group are never removed.
 */
export function toggleGroupSelection(
  selection: ReadonlySet<number>,
  groupIndices: readonly number[],
  activeLine: number,
): GroupSelectionResult {
  const entries = uniqueIndices(groupIndices);
  const all = entries.length > 0 && entries.every((index) => selection.has(index));

  if (!all) {
    const next = new Set(selection);
    for (const index of entries) {
      next.add(index);
    }
    const fallback = entries[0] ?? firstSelection(next) ?? activeLine;
    return {
      selection: sortedIndices(next),
      focus: next.has(activeLine) ? activeLine : fallback,
    };
  }

  const next = new Set(selection);
  for (const index of entries) {
    next.delete(index);
  }
  if (!next.size) {
    // The picker never allows an empty selection. Keep the active line when it
    // is a real index, otherwise the first removed line, which always exists
    // because `all` required a non-empty group.
    const fallback = Number.isInteger(activeLine) ? activeLine : (entries[0] ?? activeLine);
    return { selection: [fallback], focus: fallback };
  }
  return {
    selection: sortedIndices(next),
    focus: next.has(activeLine) ? activeLine : nearestIndex(next, activeLine),
  };
}

/** Drop non-integers, duplicates, and input order. */
function uniqueIndices(indices: readonly number[]): number[] {
  const unique = new Set<number>();
  for (const index of indices) {
    if (Number.isInteger(index)) {
      unique.add(index);
    }
  }
  return sortedIndices(unique);
}

/** Ascending copy of a selection. */
function sortedIndices(indices: Iterable<number>): number[] {
  return [...indices].sort((left, right) => left - right);
}

/** The first index in insertion order, if any. */
function firstSelection(selection: ReadonlySet<number>): number | undefined {
  return selection.values().next().value;
}

/**
 * The member of `selection` closest to `anchor`. Ties resolve to the lower
 * index because the set is walked in ascending order.
 */
function nearestIndex(selection: ReadonlySet<number>, anchor: number): number {
  const ordered = sortedIndices(selection);
  let best = ordered[0] ?? anchor;
  let bestDistance = Math.abs(best - anchor);
  for (const value of ordered) {
    const distance = Math.abs(value - anchor);
    if (distance < bestDistance) {
      best = value;
      bestDistance = distance;
    }
  }
  return best;
}
