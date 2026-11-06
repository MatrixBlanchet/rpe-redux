/**
 * Builds the downloadable PEZ export of a chart.
 *
 * The caller supplies the chart, its assets and a display name; the returned
 * blob and filename are ready for a host save dialog. JSON remains a document
 * save/open format, not an export container.
 */
import { t } from "../../../i18n/index.ts";
import { type Chart } from "../chart/chart.ts";
import { serializeOfficialChart } from "../chart/formats/official.ts";
import { serializePecChart } from "../chart/formats/pec.ts";
import { writeZip } from "../../utils/zip.ts";
import { packageEntries } from "./package.ts";

/** The containers the export dialog can write. */
export type ChartExportFormat = "pez" | "official" | "pec";

/** Filename stem for the PEZ package. */
export interface ChartExportOptions {
  name?: string;
}

/** A single-file text export ready for a download or native write. */
export interface ChartTextExport {
  text: string;
  name: string;
  mime: string;
  warnings: readonly string[];
}

/** Strip a container extension and characters a Windows file dialog rejects. */
function exportStem(name: string, fallback: string): string {
  return (name.trim() || fallback)
    .replace(/\.(json|pec|pez|zip)$/i, "")
    .replace(/[\\/:*?"<>|]/g, "_");
}

/**
 * Build a PEZ export blob and its filename from a chart and its assets.
 *
 * Defaults to a package named after the chart. Throws when the name is empty
 * after trimming its container extension.
 */
export function createChartExport(
  chart: Chart,
  assets: ReadonlyMap<string, Uint8Array>,
  chartName: string,
  options: ChartExportOptions = {},
): { blob: Blob; name: string } {
  const { name = chartName } = options;
  const snapshot: Chart = { ...chart };
  delete snapshot.chartTime;
  const stem = exportStem(String(name), "");
  if (!stem) {
    throw new Error(t("system.files.exportNameRequired"));
  }
  return {
    blob: writeZip(packageEntries(snapshot, assets, chartName)),
    name: `${stem}.pez`,
  };
}

/** Build a single-file official JSON or PEC export. */
export function createChartTextExport(
  chart: Chart,
  chartName: string,
  format: Exclude<ChartExportFormat, "pez">,
  options: ChartExportOptions = {},
): ChartTextExport {
  const { name = chartName } = options;
  const stem = exportStem(String(name), "");
  if (!stem) {
    throw new Error(t("system.files.exportNameRequired"));
  }
  if (format === "official") {
    const result = serializeOfficialChart(chart);
    return {
      text: result.text,
      name: `${stem}.json`,
      mime: "application/json",
      warnings: result.warnings,
    };
  }
  const result = serializePecChart(chart);
  return {
    text: result.text,
    name: `${stem}.pec`,
    mime: "text/plain;charset=utf-8",
    warnings: result.warnings,
  };
}
