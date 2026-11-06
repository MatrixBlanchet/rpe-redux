/**
 * SDK example for a write-capable code cell.
 *
 * A cell is one async function body. These functions mirror the shape the
 * sandbox receives: an async `redux` facade and an optional JSON `input`.
 * Type-check with `npm run check:sdk`.
 */
import type { ApiResult, ChartTransactionRequest, CodeCellApi } from "@rpe-redux/extension-sdk";

/** Unwrap the shared result envelope; a code cell may throw. */
function unwrap<T>(result: ApiResult<T>): T {
  if (!result.ok) {
    throw new Error(result.error.message ?? result.error.code);
  }
  return result.value;
}

export interface CodeCellInput {
  readonly name?: string;
}

/** Read the exact grant list without touching the chart. */
export async function grantedCapabilities(redux: CodeCellApi) {
  return redux.capabilities();
}

/** Apply a metadata change to the open chart. */
export async function renameChart(redux: CodeCellApi, input: CodeCellInput) {
  const state = await redux.document.state();
  if (!state.fingerprint) {
    return { summary: "no chart is open" };
  }
  const transaction: ChartTransactionRequest = {
    metadata: { name: input.name ?? "Untitled" },
  };
  const result = await redux.transaction.apply(transaction);
  if (!result.ok) {
    return { summary: "rejected", error: result.error };
  }
  return { summary: result.value.status, issues: result.value.issues };
}

/** Summarize the chart without returning every note. */
export async function noteDensity(redux: CodeCellApi) {
  const snapshot = unwrap(await redux.chart.snapshot());
  if (!snapshot) {
    return { summary: "no chart is open" };
  }
  const lines = snapshot.judgeLineList ?? [];
  return {
    summary: "note density by line",
    value: lines.map((line, index) => ({
      index,
      name: line.Name ?? "",
      tap: (line.notes ?? []).filter((note) => note.type === 1).length,
      hold: (line.notes ?? []).filter((note) => note.type === 2).length,
    })),
  };
}

/** Count notes without returning the full chart. */
export async function countNotes(redux: CodeCellApi) {
  const notes = unwrap(await redux.chart.notes());
  return { summary: `${notes.length} notes` };
}
