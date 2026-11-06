/**
 * Resolves the editor's cover-background URL.
 *
 * A library-backed document knows its project id and the chart's background
 * asset name; both are required to build the service URL. File-backed charts
 * and charts without a background intentionally return an empty URL.
 */
import { projectAssetUrl } from "../../core/global/library/client.ts";
import { assetPath, resourceReferences } from "../../core/global/document/resources.ts";
import type { AssetMap } from "../../core/global/document/types.ts";
import type { Chart } from "../../core/global/chart/chart.ts";

/**
 * Build the cover URL for the open document.
 *
 * Library projects resolve against the service. A file-backed chart resolves
 * the cover through its own asset map, so relative cover names still reach the
 * native document asset host.
 */
export function editorCoverUrl(
  origin: string,
  projectId: string,
  background: string,
  assets?: AssetMap,
  chartName = "",
): string {
  const name = background.trim();
  if (!name) {
    return "";
  }
  // A chart may reference an already-resolved remote or embedded image. Keep it
  // as-is; only relative asset names need the project or document URL.
  if (/^(?:https?:|data:|blob:)/iu.test(name)) {
    return name;
  }
  const id = projectId.trim();
  if (id) {
    return projectAssetUrl(origin, id, name);
  }
  const path = assets ? assetPath(assets, name, chartName) : null;
  return path ? (assets?.uri?.(path) ?? "") : "";
}

/** Resolve an editor cover from authored metadata and document resource fallbacks. */
export function editorDocumentCoverUrl(
  origin: string,
  projectId: string,
  chart: Chart,
  assets: AssetMap,
  chartName: string,
  projectBackground = "",
): string {
  const background = projectBackground || resourceReferences(chart, assets, chartName).background;
  return editorCoverUrl(origin, projectId, background, assets, chartName);
}
