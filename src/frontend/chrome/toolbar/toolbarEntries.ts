/**
 * Shared toolbar entry filtering and ordering for both row and merged flows.
 *
 * The editor rows and the default rows must agree on which entries occupy a
 * cell: a hidden action draws nothing, and a rule only exists between two
 * visible entries. Merged flows add one more rule: a seam between registered
 * rows cannot produce a leading, trailing, or doubled divider.
 */
import type { ToolbarEntry, ToolbarRowName } from "../../../core/shell/registries/toolbar.ts";

/** Whether one entry occupies a cell in a toolbar row. */
export function toolbarEntryDraws(entry: ToolbarEntry): boolean {
  switch (entry.kind) {
    case "action":
      return entry.visible?.() !== false && entry.toolbar !== false;
    case "divider":
      return false;
    default:
      return true;
  }
}

/**
 * Entries of one row with hidden actions removed and empty rules dropped.
 *
 * A divider is held until a visible entry follows it, so leading and trailing
 * rules disappear. Repeated dividers collapse to the last one, matching the
 * merged-flow cleanup below. Passing no row keeps every row's entries, which is
 * what the merged single-line and grid flows need.
 */
export function visibleToolbarEntries(
  entries: readonly ToolbarEntry[],
  row?: ToolbarRowName,
): ToolbarEntry[] {
  const visible: ToolbarEntry[] = [];
  let pending: ToolbarEntry | null = null;
  for (const entry of entries) {
    if (row !== undefined && entry.row !== row) {
      continue;
    }
    if (entry.kind === "divider") {
      if (visible.length > 0) {
        pending = entry;
      }
      continue;
    }
    if (!toolbarEntryDraws(entry)) {
      continue;
    }
    if (pending) {
      visible.push(pending);
      pending = null;
    }
    visible.push(entry);
  }
  return visible;
}

/** Drop leading, trailing, and repeated divider entries. */
export function continuousEntries(entries: readonly ToolbarEntry[]): ToolbarEntry[] {
  const drawn: ToolbarEntry[] = [];
  let pending: ToolbarEntry | null = null;
  for (const entry of entries) {
    if (entry.kind === "divider") {
      if (drawn.length > 0) {
        pending = entry;
      }
      continue;
    }
    if (pending) {
      drawn.push(pending);
      pending = null;
    }
    drawn.push(entry);
  }
  return drawn;
}
