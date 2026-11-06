/** Pure presentation rules for the left-click overlapping-object chooser. */

/**
 * The overlap chooser is a left-click picker, so it never inherits rows from
 * the right-click context-menu registry.
 */
export function overlapMenuContextSurface(): undefined {
  return undefined;
}
