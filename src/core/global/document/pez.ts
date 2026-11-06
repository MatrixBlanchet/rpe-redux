/**
 * Reads a PEZ archive into assets and RPE chart candidates.
 *
 * Archive entry, per-file and total byte limits are fixed here, `Info.txt` is
 * parsed for metadata, and non-JSON sidecars never become candidates.
 */
import { ChartLoadError } from "../chart/diagnostics.ts";
import { readZip, type ZipLimits } from "../../utils/zip.ts";
import { decodeChartText } from "../../utils/text.ts";
import { mergeInfoIntoMeta, parseInfo } from "./info.ts";
import type { OpenCandidate } from "./types.ts";
import { t } from "../../../i18n/index.ts";
import { loadingPaint, type LoadTask } from "./loading.ts";
import { normalizePath } from "../../utils/paths.ts";
import {
  parseChartEntries,
  type ChartEntryParser,
  type ParsedChartEntries,
} from "./chartParsing.ts";

/** Unpacks an archive into named byte entries, reporting progress per entry. */
export type ArchiveReader = (
  buffer: Uint8Array | ArrayBuffer,
  limits: ZipLimits,
  onProgress?: (completed: number, total: number) => void | Promise<void>,
) => Promise<Map<string, Uint8Array>>;

/** Fixed archive safety limits: entry count, per-entry bytes and total bytes. */
const PEZ_LIMITS = {
  maxEntries: 16384,
  maxEntryBytes: 256 * 1024 ** 2,
  maxTotalBytes: 1024 * 1024 ** 2,
};

/**
 * Read a PEZ archive into chart candidates and their assets.
 *
 * Only RPE JSON entries become candidates; sidecars and foreign formats stay
 * assets. An Info.txt beside a chart supplies its metadata and marks it as the
 * preferred chart to open. Throws `ChartLoadError` when nothing parses.
 */
export async function readPez(
  buffer: Uint8Array | ArrayBuffer,
  task?: LoadTask,
  parseCharts: ChartEntryParser = parseChartEntries,
  readArchive: ArchiveReader = readZip,
): Promise<{
  candidates: OpenCandidate[];
  assets: Map<string, Uint8Array>;
  preferred: string | null;
}> {
  // Throttle mid-unpack paints so a large archive does not yield a frame per entry.
  let lastPaint = 0;
  const assets = await readArchive(buffer, {
    ...PEZ_LIMITS,
    onProgress: task
      ? async (done, total) => {
          task.update("unpack", done, total);
          if (performance.now() - lastPaint > 32) {
            await loadingPaint();
            lastPaint = performance.now();
          }
        }
      : undefined,
  });
  task?.update("parse");
  if (task) {
    await loadingPaint();
  }
  const parsed: ParsedChartEntries = await parseCharts(assets);
  const candidates: OpenCandidate[] = parsed.candidates;
  if (!candidates.length) {
    throw new ChartLoadError(
      parsed.issues.length
        ? parsed.issues
        : [
            {
              id: "document:package",
              category: "document",
              path: "package",
              messageKey: "model.chart.invalidDocument",
            },
          ],
      `${t("system.files.chartNotFound")}\n${parsed.errors.join("\n")}`,
    );
  }
  // Attach each Info.txt to the chart its `Chart` field names.
  const preferredNames = new Set<string>();
  for (const [name, bytes] of assets) {
    if (!/(^|\/)info\.txt$/i.test(name)) {
      continue;
    }
    const info = parseInfo(decodeChartText(bytes).replace(/^\uFEFF/, ""));
    const directory = name.slice(0, name.lastIndexOf("/") + 1);
    const candidate = candidates.find(
      (candidate) =>
        normalizePath(candidate.name) === normalizePath(directory + (info.Chart ?? "")),
    );
    if (candidate) {
      candidate.info = info;
      mergeInfoIntoMeta(candidate.chart, info);
      preferredNames.add(candidate.name);
    }
  }
  const preferred = preferredNames.size === 1 ? [...preferredNames][0] : null;
  task?.update("parse", 1, 1);
  // Put the single Info.txt-selected chart first; leave the rest in archive order.
  candidates.sort((a, b) => Number(b.name === preferred) - Number(a.name === preferred));
  return { candidates, assets, preferred };
}
