/**
 * Main-thread front end for the chart parsing worker: sends archive entries to
 * the worker and rebuilds candidates with primed fingerprints on return. Parsing
 * rules stay in core; hosts without workers parse in-process.
 */
import {
  markChartObjectIdsNormalized,
  type Chart,
  type JudgeLine,
} from "../../../../../../core/global/chart/chart.ts";
import {
  parseChartEntries,
  type ParsedChartEntries,
} from "../../../../../../core/global/document/chartParsing.ts";
import type { OpenCandidate } from "../../../../../../core/global/document/types.ts";
import { primeChartFingerprint } from "../../../../../../core/edit/document/chartRevision.ts";

let nextRequestId = 1;

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
  fingerprint: string;
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

/**
 * Parses chart JSON away from the UI thread when module workers are available.
 *
 * The worker returns the header first and then line batches, and the source
 * bytes are copied before transfer because the asset map stays with the session.
 */
export async function parseChartEntriesOffThread(
  entries: Iterable<[string, Uint8Array]>,
): Promise<ParsedChartEntries> {
  const jsonEntries = [...entries].filter(([name]) => /\.json$/i.test(name));
  if (!jsonEntries.length || typeof Worker === "undefined") {
    return parseChartEntries(jsonEntries);
  }

  const worker = new Worker(new URL("./chartParseWorker.ts", import.meta.url), {
    type: "module",
  });
  const id = nextRequestId++;
  const payload = jsonEntries.map(([name, bytes]) => ({
    name,
    bytes: bytes.slice().buffer,
  }));
  const transfer = payload.map(({ bytes }) => bytes);
  return new Promise<ParsedChartEntries>((resolve) => {
    const candidates: OpenCandidate[] = [];
    const normalized: boolean[] = [];
    const fingerprints: string[] = [];
    let errors: string[] = [];
    let issues: ParsedChartEntries["issues"] = [];
    let settled = false;
    /** Terminates the worker and resolves the parse exactly once. */
    const finish = (result: ParsedChartEntries): void => {
      if (settled) {
        return;
      }
      settled = true;
      worker.terminate();
      resolve(result);
    };
    /** Completes the parse on the main thread after a worker failure. */
    const fallback = (): void => {
      finish(parseChartEntries(jsonEntries));
    };
    worker.onmessage = (event: MessageEvent<ParseResponse>) => {
      const message = event.data;
      if (message.id !== id) {
        return;
      }
      if (message.kind === "start") {
        for (const entry of message.candidates) {
          const { chart, normalized: entryNormalized, ...meta } = entry;
          candidates.push({ ...meta, chart: { ...chart, judgeLineList: [] } });
          normalized.push(entryNormalized);
          fingerprints.push(entry.fingerprint);
        }
        errors = message.errors;
        issues = message.issues;
        return;
      }
      if (message.kind === "lines") {
        candidates[message.candidateIndex]?.chart.judgeLineList?.push(...message.lines);
        return;
      }
      for (let index = 0; index < candidates.length; index++) {
        if (normalized[index]) {
          markChartObjectIdsNormalized(candidates[index].chart);
        }
        if (fingerprints[index]) {
          primeChartFingerprint(candidates[index].chart, fingerprints[index]);
        }
      }
      finish({ candidates, errors, issues });
    };
    worker.onerror = (event) => {
      if (event.error instanceof Error) {
        fallback();
      } else {
        fallback();
      }
    };
    worker.postMessage({ id, entries: payload }, transfer);
  });
}
