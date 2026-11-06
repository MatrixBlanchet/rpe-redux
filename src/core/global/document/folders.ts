/**
 * Owns the asset-library organization stored with the chart.
 *
 * RPE's chart schema has no folder field, and folders group the library list
 * rather than the filesystem. The organization is therefore an extra top-level
 * chart field. Because the chart serializes whole, JSON projects, PEZ archives
 * and browser exports all carry it without a sidecar. Unknown top-level fields
 * are ignored by RPE and preserved here, so a chart without the field still
 * opens unchanged.
 */

/** Top-level chart field that holds the asset-folder paths. */
export const CHART_FOLDERS_KEY = "reduxAssetFolders";

type FoldersObject = Record<string, unknown> & { [CHART_FOLDERS_KEY]?: unknown };

/**
 * True when the chart carries an explicit folder organization.
 *
 * An absent field means the panel shows its default group. An explicit empty
 * array means every group was removed, so the workspace stays empty until an
 * asset is added.
 */
export function hasAssetFoldersField(chart: unknown): boolean {
  return Boolean(
    chart &&
    typeof chart === "object" &&
    !Array.isArray(chart) &&
    Object.hasOwn(chart, CHART_FOLDERS_KEY),
  );
}

/**
 * Normalize folder paths and drop duplicates while preserving authored order.
 *
 * The empty string marks the root `Default` group, so it is stored explicitly
 * and an empty list unambiguously means "no groups". Segments that are empty,
 * `.` or `..` are discarded.
 */
export function normalizeAssetFolders(values: readonly unknown[] | null | undefined): string[] {
  const folders = new Set<string>();
  for (const value of values ?? []) {
    if (typeof value !== "string") {
      continue;
    }
    if (value === "") {
      folders.add("");
      continue;
    }
    const parts = value.replaceAll("\\", "/").trim().split("/").filter(Boolean);
    if (!parts.length || parts.some((part) => part === "." || part === "..")) {
      continue;
    }
    folders.add(parts.join("/"));
  }
  return [...folders];
}

/** Folders stored in a chart object; empty when the field is absent or malformed. */
export function assetFoldersOfChart(chart: unknown): string[] {
  if (!chart || typeof chart !== "object" || Array.isArray(chart)) {
    return [];
  }
  const value = (chart as FoldersObject)[CHART_FOLDERS_KEY];
  return Array.isArray(value) ? normalizeAssetFolders(value) : [];
}

/**
 * Returns the chart with its folder organization replaced.
 *
 * The field is written even when the normalized list is empty, because only an
 * explicit empty array distinguishes "no groups" from "no folder field".
 *
 * The same object is returned when the stored folders already match, so an
 * unrelated rename or image edit does not create an edit-history entry.
 */
export function withChartFolders<T extends object>(chart: T, folders: readonly string[]): T {
  const normalized = normalizeAssetFolders(folders);
  const current = assetFoldersOfChart(chart);
  const present = hasAssetFoldersField(chart);
  if (
    present &&
    current.length === normalized.length &&
    current.every((folder, index) => folder === normalized[index])
  ) {
    return chart;
  }
  const next: FoldersObject = { ...(chart as FoldersObject) };
  next[CHART_FOLDERS_KEY] = normalized;
  return next as T;
}
