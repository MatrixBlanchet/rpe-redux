/**
 * Worker entry for chart parsing: normalizes object ids and streams candidates
 * so the main thread never parses a large chart. Fingerprints are deliberately
 * not computed here: the installed session warms the deterministic digest in
 * yielding slices after the first frame, and save/conflict checks reuse it until
 * a line or chart object identity changes. The worker communicates only through
 * messages and keeps no editor state.
 */
import {
  normalizeChartObjectIds,
  type Chart,
  type JudgeLine,
} from "../../../../../../core/global/chart/chart.ts";
import {
  parseChartEntries,
  type ParsedChartEntries,
} from "../../../../../../core/global/document/chartParsing.ts";
import { yieldToHost } from "../../../../../../core/utils/yieldToHost.ts";

interface ParseRequest {
  id: number;
  entries: Array<{ name: string; bytes: ArrayBuffer }>;
}

interface CandidateStart {
  name: string;
  chart: Chart;
  info?: Record<string, string>;
  desktop?: boolean;
  project?: {
    assetFolders?: string[];
    viewState?: { lineIndex?: number };
  } | null;
  diagnostics?: ParsedChartEntries["candidates"][number]["diagnostics"];
  readOnly?: boolean;
  normalized: boolean;
}

type ParseResponse =
  | {
      id: number;
      kind: "start";
      candidates: CandidateStart[];
      errors: string[];
      issues: ParsedChartEntries["issues"];
    }
  | {
      id: number;
      kind: "lines";
      candidateIndex: number;
      lines: JudgeLine[];
    }
  | { id: number; kind: "done" };

/** Judge lines sent in one structured-clone batch. */
const CHUNK_LINES = 12;

/** Worker scope typed for the parse request/response protocol. */
const workerScope = globalThis as typeof globalThis & {
  onmessage: ((event: MessageEvent<ParseRequest>) => void) | null;
  postMessage(message: ParseResponse): void;
};

/** Parses one request, then streams normalized candidate headers and line batches. */
workerScope.onmessage = (event) => {
  const entries: Array<{ name: string; bytes: ArrayBuffer }> = event.data.entries;
  void (async () => {
    const result = parseChartEntries(
      entries.map(({ name, bytes }) => [name, new Uint8Array(bytes)] as const),
    );
    const candidates: CandidateStart[] = result.candidates.map((candidate) => {
      const chart = normalizeChartObjectIds(candidate.chart);
      return {
        name: candidate.name,
        chart: { ...chart, judgeLineList: [] },
        info: candidate.info,
        desktop: candidate.desktop,
        project: candidate.project,
        diagnostics: candidate.diagnostics,
        readOnly: candidate.readOnly,
        normalized: true,
      };
    });
    workerScope.postMessage({
      id: event.data.id,
      kind: "start",
      candidates,
      errors: result.errors,
      issues: result.issues,
    });
    for (let candidateIndex = 0; candidateIndex < result.candidates.length; candidateIndex++) {
      const lines = result.candidates[candidateIndex].chart.judgeLineList ?? [];
      for (let offset = 0; offset < lines.length; offset += CHUNK_LINES) {
        workerScope.postMessage({
          id: event.data.id,
          kind: "lines",
          candidateIndex,
          lines: lines.slice(offset, offset + CHUNK_LINES),
        });
        // Let the receiving document breathe between structured-clone batches.
        await yieldToHost();
      }
    }
    workerScope.postMessage({ id: event.data.id, kind: "done" });
  })();
};
