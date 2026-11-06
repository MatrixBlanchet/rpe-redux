/**
 * Imports a chart and its resources into the SQLite library.
 *
 * Opening an external JSON/PEZ is an import, not a live file binding. The
 * caller supplies the already parsed chart and asset map; this module reads the
 * lazy bytes, serializes the chart once, and writes a normal library project.
 */
import { serializeChart } from "../chart/chart.ts";
import type { AssetMap } from "../document/types.ts";
import { materializeAssets } from "./document.ts";
import { saveLibraryDocument, type LibrarySaveResult } from "./save.ts";
import { LocalLibraryError, type LocalLibrary } from "./client.ts";
import type { LibraryViewState } from "./types.ts";

/** Input for importing an opened document into the library. */
export interface LibraryImportInput {
  library: LocalLibrary;
  chart: unknown;
  name: string;
  assets: AssetMap;
  /** Existing project to refresh, or omitted to create a new one. */
  projectId?: string;
  group?: string;
  viewState?: LibraryViewState;
  assetFolders?: readonly string[];
  /** Reuse text the caller already produced. */
  chartJson?: string;
  onProgress?: (value: number) => void;
}

/** Import one opened document into the library. */
export async function importChartToLibrary(input: LibraryImportInput): Promise<LibrarySaveResult> {
  const chartJson = input.chartJson ?? serializeChart(input.chart);
  const assets = await materializeAssets(input.assets);
  const saveInput = {
    library: input.library,
    ...(input.projectId ? { projectId: input.projectId } : {}),
    chart: input.chart,
    chartJson,
    name: input.name,
    assets,
    ...(input.group ? { group: input.group } : {}),
    ...(input.viewState ? { viewState: input.viewState } : {}),
    ...(input.assetFolders ? { assetFolders: input.assetFolders } : {}),
    ...(input.onProgress ? { onProgress: input.onProgress } : {}),
  };
  try {
    return await saveLibraryDocument(saveInput);
  } catch (error) {
    if (!(input.projectId && error instanceof LocalLibraryError && error.status === 404)) {
      throw error;
    }
    // A path catalogue can reference a project that no longer exists. Retry as
    // a new project so re-importing that source repairs the stale identity
    // instead of surfacing the backend's missing-resource response.
    return saveLibraryDocument({ ...saveInput, projectId: undefined });
  }
}
