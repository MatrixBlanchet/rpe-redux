// Toolbar overflow measurement: one pure rule drives narrow-state rendering and edge controls.

const OVERFLOW_EPSILON = 1;

/** A measured horizontal range belonging to one toolbar row. */
export interface ToolbarRowOverflowMeasurement {
  scrollLeft: number;
  clientWidth: number;
  scrollWidth: number;
}

/** The dimensions needed to determine whether the toolbar has entered narrow mode. */
export interface ToolbarOverflowMeasurement {
  toolbarWidth: number;
  toolbarScrollWidth: number;
  rows: readonly ToolbarRowOverflowMeasurement[];
}

/** The visible overflow state used by the toolbar frame and its scroll controls. */
export interface ToolbarOverflowState {
  isNarrow: boolean;
  canScrollStart: boolean;
  canScrollEnd: boolean;
}

/** A row's natural content width and visible viewport used for shared scrolling. */
export interface SharedScrollRowMeasurement {
  clientWidth: number;
  contentWidth: number;
}

/** Calculates the invisible trailing space needed to give every row one scroll range. */
export function calculateSharedScrollCompensation(
  rows: readonly SharedScrollRowMeasurement[],
): number[] {
  const sharedMaxScroll = Math.max(
    0,
    ...rows.map((row) => Math.max(0, row.contentWidth - row.clientWidth)),
  );
  return rows.map((row) =>
    Math.max(0, sharedMaxScroll - Math.max(0, row.contentWidth - row.clientWidth)),
  );
}

/** Calculates narrow mode and scroll affordances from measured layout dimensions. */
export function calculateToolbarOverflowState(
  measurement: ToolbarOverflowMeasurement,
): ToolbarOverflowState {
  const { toolbarWidth, toolbarScrollWidth, rows } = measurement;
  const canScrollStart = rows.some((row) => row.scrollLeft > OVERFLOW_EPSILON);
  const canScrollEnd = rows.some(
    (row) => row.scrollLeft + row.clientWidth < row.scrollWidth - OVERFLOW_EPSILON,
  );
  const isNarrow =
    toolbarScrollWidth > toolbarWidth + OVERFLOW_EPSILON || canScrollStart || canScrollEnd;
  return { isNarrow, canScrollStart, canScrollEnd };
}

/** Reads toolbar and row dimensions from the mounted toolbar surface. */
export function readToolbarOverflowState(root: HTMLElement): ToolbarOverflowState {
  const rows = Array.from(root.querySelectorAll<HTMLElement>(".redux-toolbar-line"));
  return calculateToolbarOverflowState({
    toolbarWidth: root.clientWidth,
    toolbarScrollWidth: root.scrollWidth,
    rows: rows.map((row) => ({
      scrollLeft: row.scrollLeft,
      clientWidth: row.clientWidth,
      scrollWidth: row.scrollWidth,
    })),
  });
}
