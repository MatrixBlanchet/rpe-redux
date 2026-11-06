/**
 * Transport-neutral MCP request adapter for the mounted editor.
 *
 * The loopback WebSocket bridge in `src/frontend/platform/mcpBridge.ts` forwards
 * one JSON-RPC request to `handle`. Chart data comes from the detached read
 * model; chart transactions go through the document coordinator and commit with
 * the transaction owner. Enabling MCP is the consent boundary, so admitted
 * writes follow fingerprint and room-role checks.
 */
import type {
  ChartApi,
  ChartReadCollection,
  ChartReadPage,
  ChartReadPageOptions,
  ChartReadState,
} from "../chart/api.ts";
import type {
  ChangeResult,
  DocumentChangeCoordinator,
  DocumentCoordinationState,
} from "../document/changeCoordinator.ts";
import type {
  ChartTransactionPreviewResult,
  ChartTransactionResult,
  TransactionIssue,
} from "../transaction/contract.ts";
import type { HistoryEntryOrigin } from "../session/history.ts";
import type { DocumentRevisions } from "../../contracts/revisions.ts";
import { revisionConflicts } from "../../contracts/revisions.ts";
import type {
  CodeCellErrorCode,
  CodeCellProfile,
  CodeCellRequest,
  CodeCellResult,
} from "../../codecell/contract.ts";
import { isCodeCellProfile } from "../../codecell/profiles.ts";
import { isRecord } from "../../utils/guards.ts";
import { getMcpGuide } from "./guide.ts";

export type McpRevisions = DocumentRevisions;

export type McpDocumentState = Pick<
  DocumentCoordinationState,
  "lifecycle" | "operation" | "source" | "dirty"
> & {
  /** Document/file name shown by the host's document lifecycle. */
  readonly name: string;
  /** Chart `META.name`, which is what the editor window title shows. */
  readonly title: string;
  /** Local path for a file-backed document; null for a new or library document. */
  readonly path: string | null;
  readonly format: "memory" | "json" | "pez";
  readonly revisions: McpRevisions;
};

export interface McpReadParams {
  readonly collection: ChartReadCollection;
  readonly chartFingerprint?: string | null;
  readonly cursor?: string | null;
  readonly limit?: number;
}

export interface McpValidateParams {
  readonly request: unknown;
  readonly expected?: Partial<McpRevisions>;
}

export type McpErrorCode =
  | "disabled"
  | "unavailable"
  | "invalid_request"
  | "stale_read"
  | "conflict"
  | "rejected"
  | "declined"
  | "method_not_allowed"
  | "failed"
  | "busy"
  | "timeout"
  | "cancelled"
  | "runtime";

export interface McpError {
  readonly code: McpErrorCode;
  readonly message?: string;
  readonly details?: unknown;
}

export type McpResponse<T> =
  | {
      readonly ok: true;
      readonly value: T;
      readonly revisions: McpRevisions;
    }
  | {
      readonly ok: false;
      readonly error: McpError;
      readonly revisions: McpRevisions | null;
    };

export interface McpHost {
  readonly chart: () => Pick<ChartApi, "state" | "read"> | null;
  readonly state: () => McpDocumentState;
  /** Validate only; the transaction owner performs the commit. */
  readonly validate: (
    request: unknown,
    revisions: McpRevisions,
  ) => ChartTransactionPreviewResult | Promise<ChartTransactionPreviewResult>;
}

export interface McpTransactionOrigin {
  readonly clientId?: string;
  readonly requestId?: string;
}

export interface McpTransactionApplyContext {
  readonly expectedChartFingerprint: string;
  readonly origin: HistoryEntryOrigin;
}

export interface McpTransactionHost {
  readonly coordinator: Pick<DocumentChangeCoordinator, "submit" | "trackPending">;
  readonly apply: (
    request: unknown,
    context: McpTransactionApplyContext,
  ) => ChartTransactionResult | Promise<ChartTransactionResult>;
}

/** The one-shot code-cell runner mounted by the active editor. */
export interface McpCodeHost {
  run(request: CodeCellRequest): Promise<CodeCellResult>;
}

export interface McpAdapterOptions extends McpHost {
  /** A boolean or a live probe; the Settings toggle is the consent boundary. */
  readonly enabled?: boolean | (() => boolean);
  /** Room authorization: false blocks chart.apply without touching the session. */
  readonly writeAllowed?: () => boolean;
  readonly transaction: McpTransactionHost;
  /** Field-level AI permissions checked before a chart transaction is applied. */
  readonly aiPolicy?: (request: unknown) => readonly TransactionIssue[];
  /** Present only while the editor mount can run a code cell. */
  readonly code?: McpCodeHost;
}

export interface McpAdapter {
  readonly handle: (request: unknown) => Promise<McpResponse<unknown>>;
}

/** True for one of the four readable chart collections. */
function isCollection(value: unknown): value is ChartReadCollection {
  return value === "metadata" || value === "lines" || value === "notes" || value === "events";
}

/** Freezes the revision triple carried by an MCP response. */
function revisionsFrom(state: McpDocumentState): McpRevisions {
  return Object.freeze({
    chartFingerprint: state.revisions.chartFingerprint,
    diskSnapshot: state.revisions.diskSnapshot,
    generation: state.revisions.generation,
  });
}

/** Combines chart-read revisions with the document's disk snapshot. */
function chartRevisions(state: McpRevisions, chartState: ChartReadState): McpRevisions {
  return Object.freeze({
    chartFingerprint: chartState.chartFingerprint,
    diskSnapshot: state.diskSnapshot,
    generation: chartState.generation,
  });
}

/** True when all three revision fields are equal. */
function sameRevisions(left: McpRevisions, right: McpRevisions): boolean {
  return (
    left.chartFingerprint === right.chartFingerprint &&
    left.diskSnapshot === right.diskSnapshot &&
    left.generation === right.generation
  );
}

/** Builds a frozen failed response with optional message and details. */
function failure(
  code: McpErrorCode,
  revisions: McpRevisions | null,
  message?: string,
  details?: unknown,
): McpResponse<never> {
  return Object.freeze({
    ok: false,
    error: Object.freeze({
      code,
      ...(message ? { message } : {}),
      ...(details === undefined ? {} : { details }),
    }),
    revisions,
  });
}

/** Builds a frozen successful response. */
function success<T>(value: T, revisions: McpRevisions): McpResponse<T> {
  return Object.freeze({ ok: true, value, revisions });
}

/** Chooses the revisions a chart-read page reports. */
function pageRevisions(current: McpRevisions, page: ChartReadPage<unknown>): McpRevisions {
  if (page.status === "ok") {
    return chartRevisions(current, page);
  }
  if (page.status === "stale_read") {
    return Object.freeze({
      chartFingerprint: page.currentFingerprint,
      diskSnapshot: current.diskSnapshot,
      generation: page.currentGeneration,
    });
  }
  return current;
}

/** Validates chart.read parameters; null means an invalid request. */
function readOptions(value: unknown): McpReadParams | null {
  if (!isRecord(value) || !isCollection(value.collection)) {
    return null;
  }
  if (
    value.chartFingerprint !== undefined &&
    value.chartFingerprint !== null &&
    typeof value.chartFingerprint !== "string"
  ) {
    return null;
  }
  if (value.cursor !== undefined && value.cursor !== null && typeof value.cursor !== "string") {
    return null;
  }
  if (value.limit !== undefined && typeof value.limit !== "number") {
    return null;
  }
  return {
    collection: value.collection,
    chartFingerprint: value.chartFingerprint as string | null | undefined,
    cursor: value.cursor as string | null | undefined,
    limit: value.limit as number | undefined,
  };
}

type Parsed<T> = { readonly ok: true; readonly value?: T } | { readonly ok: false };

/** Parse the optional revision pin shared by validation and code.run. */
function parseRevisionPin(value: unknown): Parsed<Partial<McpRevisions>> {
  if (value === undefined) {
    return { ok: true };
  }
  if (!isRecord(value)) {
    return { ok: false };
  }
  for (const key of ["chartFingerprint", "diskSnapshot"] as const) {
    const revision = value[key];
    if (revision !== undefined && revision !== null && typeof revision !== "string") {
      return { ok: false };
    }
  }
  const generation = value.generation;
  if (
    generation !== undefined &&
    (typeof generation !== "number" || !Number.isSafeInteger(generation) || generation < 0)
  ) {
    return { ok: false };
  }
  return { ok: true, value: value as Partial<McpRevisions> };
}

/** Parse the optional audit origin shared by apply and code.run. */
function parseOrigin(value: unknown): Parsed<McpTransactionOrigin> {
  if (value === undefined) {
    return { ok: true };
  }
  if (!isRecord(value)) {
    return { ok: false };
  }
  for (const key of ["clientId", "requestId"] as const) {
    const field = value[key];
    if (field !== undefined && typeof field !== "string") {
      return { ok: false };
    }
  }
  return { ok: true, value: value as McpTransactionOrigin };
}

/** Validates chart.validate parameters, including the optional revision pin. */
function validateOptions(value: unknown): McpValidateParams | null {
  if (!isRecord(value) || !("request" in value)) {
    return null;
  }
  const expected = parseRevisionPin(value.expected);
  if (!expected.ok) {
    return null;
  }
  return {
    request: value.request,
    ...(expected.value ? { expected: expected.value } : {}),
  };
}

interface McpApplyParams {
  readonly request: unknown;
  readonly expectedChartFingerprint: string;
  readonly origin?: McpTransactionOrigin;
}

/** Validates chart.apply parameters; a base fingerprint is required. */
function applyOptions(value: unknown): McpApplyParams | null {
  if (!isRecord(value) || !("request" in value)) {
    return null;
  }
  if (typeof value.expectedChartFingerprint !== "string") {
    return null;
  }
  const origin = parseOrigin(value.origin);
  if (!origin.ok) {
    return null;
  }
  return {
    request: value.request,
    expectedChartFingerprint: value.expectedChartFingerprint,
    ...(origin.value ? { origin: origin.value } : {}),
  };
}

interface McpCodeRunParams {
  readonly source: string;
  readonly profile?: CodeCellProfile;
  readonly args?: unknown;
  readonly expected?: Partial<McpRevisions>;
  readonly timeoutMs?: number;
}

/** Validates code-cell source, profile, args, revision pin, and timeout bounds. */
function codeRunOptions(value: unknown): McpCodeRunParams | null {
  if (!isRecord(value) || typeof value.source !== "string" || !value.source.trim()) {
    return null;
  }
  const profile = value.profile;
  if (profile !== undefined && !isCodeCellProfile(profile)) {
    return null;
  }
  if (value.args !== undefined && value.args !== null && typeof value.args !== "object") {
    return null;
  }
  if (value.timeoutMs !== undefined) {
    if (
      typeof value.timeoutMs !== "number" ||
      !Number.isSafeInteger(value.timeoutMs) ||
      value.timeoutMs < 1_000 ||
      value.timeoutMs > 20_000
    ) {
      return null;
    }
  }
  const expected = parseRevisionPin(value.expected);
  if (!expected.ok) {
    return null;
  }
  return {
    source: value.source,
    ...(profile !== undefined ? { profile } : {}),
    ...(value.args !== undefined ? { args: value.args } : {}),
    ...(expected.value ? { expected: expected.value } : {}),
    ...(value.timeoutMs !== undefined ? { timeoutMs: value.timeoutMs as number } : {}),
  };
}

/** Builds the audit origin stored on a committed MCP history entry. */
function mcpOrigin(origin: McpTransactionOrigin | undefined): HistoryEntryOrigin {
  return Object.freeze({
    kind: "mcp",
    ...(origin?.clientId ? { clientId: origin.clientId } : {}),
    ...(origin?.requestId ? { requestId: origin.requestId } : {}),
  });
}

/** Maps a coordinated transaction result onto the MCP response shape. */
function transactionResponse(
  result: ChangeResult<ChartTransactionResult>,
  state: () => McpDocumentState,
  expectedChartFingerprint: string,
): McpResponse<ChartTransactionResult> {
  const revisions = revisionsFrom(state());
  if (result.status === "conflict") {
    return failure("conflict", revisions, "MCP transaction base fingerprint is stale", {
      expectedFingerprint: expectedChartFingerprint,
      currentFingerprint: revisions.chartFingerprint,
      conflicts: result.conflicts,
    });
  }
  if (result.status === "stale") {
    return failure("conflict", revisions, "MCP transaction document generation is stale", {
      expectedFingerprint: expectedChartFingerprint,
      currentFingerprint: revisions.chartFingerprint,
      requestedGeneration: result.requestedGeneration,
      currentGeneration: result.currentGeneration,
    });
  }
  if (result.status === "rejected") {
    return failure("rejected", revisions, result.message ?? result.reason, result);
  }
  const value = result.value;
  if (!value) {
    return failure("failed", revisions, "MCP transaction returned no result");
  }
  if (value.status === "conflict") {
    return failure("conflict", revisions, "MCP transaction commit fingerprint is stale", value);
  }
  if (value.status === "rejected" || value.status === "unavailable") {
    return failure("rejected", revisions, "MCP transaction was rejected", value);
  }
  return success(value, revisions);
}

/**
 * Code-cell failures that cannot be reported as a normal cell result.
 *
 * A syntax or capability error is the cell's own outcome and stays inside the
 * result envelope. A service-state failure (runtime, busy, timeout, cancelled)
 * must reach the transport so an HTTP or MCP client can retry with the right
 * status instead of treating an unexecuted cell as a completed run.
 */
const CELL_RUN_TRANSPORT_CODES: Partial<Record<CodeCellErrorCode, McpErrorCode>> = Object.freeze({
  disabled: "disabled",
  invalid_request: "invalid_request",
  stale_read: "stale_read",
  runtime: "runtime",
  busy: "busy",
  timeout: "timeout",
  cancelled: "cancelled",
});

/** Builds the transport-neutral MCP adapter over a mounted editor. */
export function createMcpAdapter(options: McpAdapterOptions): McpAdapter {
  /** Resolves the live consent flag. */
  const isEnabled = () =>
    typeof options.enabled === "function" ? options.enabled() : options.enabled === true;

  /** Returns the bundled code-cell guide with current revisions. */
  const guideResponse = (current: McpRevisions): McpResponse<{ text: string }> =>
    success(Object.freeze({ text: getMcpGuide() }), current);

  /** Checks the revision pin, then runs one code cell with the requested profile. */
  const runCell = async (
    params: McpCodeRunParams,
    current: McpRevisions,
  ): Promise<McpResponse<unknown>> => {
    if (!options.code) {
      return failure("disabled", current, "Code execution is unavailable");
    }
    const conflicts = revisionConflicts(params.expected, current);
    if (conflicts.length) {
      return failure("stale_read", current, "Code cell base revision is stale", {
        conflicts,
        expected: params.expected,
        current,
      });
    }
    try {
      const result = await options.code.run({
        source: params.source,
        profile: params.profile ?? "write",
        ...(params.args !== undefined ? { args: params.args } : {}),
        ...(params.expected !== undefined ? { expected: params.expected } : {}),
        ...(params.timeoutMs !== undefined ? { timeoutMs: params.timeoutMs } : {}),
      });
      const after = revisionsFrom(options.state());
      if (result.error) {
        const code = CELL_RUN_TRANSPORT_CODES[result.error.code];
        if (code) {
          return failure(code, after, result.error.message, result);
        }
      }
      return success(result, after);
    } catch (error) {
      return failure(
        "failed",
        revisionsFrom(options.state()),
        error instanceof Error ? error.message : String(error),
      );
    }
  };

  /** Dispatches one JSON-RPC request to its MCP method. */
  const handle = async (request: unknown): Promise<McpResponse<unknown>> => {
    let currentState: McpDocumentState;
    try {
      currentState = options.state();
    } catch (error) {
      return failure("failed", null, error instanceof Error ? error.message : String(error));
    }
    const current = revisionsFrom(currentState);
    if (!isRecord(request) || typeof request.method !== "string") {
      return failure("invalid_request", current, "MCP request must contain a method");
    }

    // The HTTP code-cell routes use the `cell.*` methods and do not require MCP.
    if (request.method === "cell.guide") {
      if (request.params !== undefined) {
        return failure("invalid_request", current, "cell.guide does not accept params");
      }
      return guideResponse(current);
    }

    if (request.method === "cell.run") {
      const params = codeRunOptions(request.params);
      if (!params) {
        return failure("invalid_request", current, "cell.run parameters are invalid");
      }
      return runCell(params, current);
    }

    // Everything below is the MCP tool surface.
    if (!isEnabled()) {
      return failure("disabled", current, "MCP access is disabled");
    }

    if (request.method === "code.guide") {
      if (request.params !== undefined) {
        return failure("invalid_request", current, "code.guide does not accept params");
      }
      return guideResponse(current);
    }

    if (request.method === "code.run") {
      const params = codeRunOptions(request.params);
      if (!params) {
        return failure("invalid_request", current, "code.run parameters are invalid");
      }
      return runCell(params, current);
    }

    if (request.method === "document.state") {
      if (request.params !== undefined) {
        return failure("invalid_request", current, "document.state does not accept params");
      }
      return success(Object.freeze({ ...currentState, revisions: current }), current);
    }

    if (request.method === "chart.read") {
      const params = readOptions(request.params);
      if (!params) {
        return failure("invalid_request", current, "chart.read requires a collection");
      }
      const chart = options.chart();
      if (!chart) {
        return failure("unavailable", current, "No editor chart runtime connected");
      }
      let page: ChartReadPage<unknown>;
      try {
        page = chart.read(
          params.collection,
          params as ChartReadPageOptions,
        ) as ChartReadPage<unknown>;
      } catch (error) {
        return failure("failed", current, error instanceof Error ? error.message : String(error));
      }
      const observed = pageRevisions(current, page);
      if (page.status === "invalid_request") {
        return failure("invalid_request", observed, "Invalid chart read cursor", page);
      }
      if (page.status === "stale_read") {
        return failure("stale_read", observed, "Chart read cursor is stale", page);
      }
      return success(page, observed);
    }

    if (request.method === "chart.validate") {
      const params = validateOptions(request.params);
      if (!params) {
        return failure("invalid_request", current, "chart.validate requires a request");
      }
      const conflicts = revisionConflicts(params.expected, current);
      if (conflicts.length) {
        return failure("stale_read", current, "Validation base revision is stale", {
          conflicts,
          expected: params.expected,
          current,
        });
      }
      if (!options.chart()) {
        return failure("unavailable", current, "No editor chart runtime connected");
      }
      const restricted = options.aiPolicy?.(params.request) ?? [];
      if (restricted.length) {
        return success(
          Object.freeze({
            status: "rejected",
            affectedObjectIds: Object.freeze([]),
            issues: restricted,
          }),
          current,
        );
      }
      try {
        const result = await options.validate(params.request, current);
        const after = revisionsFrom(options.state());
        if (!sameRevisions(current, after)) {
          return failure("stale_read", after, "Document changed during validation", {
            requested: current,
            current: after,
          });
        }
        // Validation never retains a preview, so its previewId is always null.
        // The MCP surface omits it rather than offering an unusable handle.
        return success(
          Object.freeze({
            status: result.status,
            affectedObjectIds: result.affectedObjectIds,
            issues: result.issues,
          }),
          current,
        );
      } catch (error) {
        return failure("failed", current, error instanceof Error ? error.message : String(error));
      }
    }

    if (request.method === "chart.apply") {
      const params = applyOptions(request.params);
      if (!params) {
        return failure(
          "invalid_request",
          current,
          "chart.apply requires request and expectedChartFingerprint",
        );
      }
      if (options.writeAllowed && !options.writeAllowed()) {
        return failure("rejected", current, "The active room role is read-only");
      }
      const restricted = options.aiPolicy?.(params.request) ?? [];
      if (restricted.length) {
        return failure(
          "rejected",
          current,
          "The request is restricted by the user's AI access settings",
          { issues: restricted },
        );
      }
      const origin = mcpOrigin(params.origin);
      const pending = options.transaction.coordinator.trackPending({
        kind: "mcp",
        origin: { ...origin },
        base: {
          chartFingerprint: params.expectedChartFingerprint,
          diskSnapshot: current.diskSnapshot,
          generation: current.generation,
        },
        payload: params.request,
      });
      try {
        const queued = await options.transaction.coordinator.submit<ChartTransactionResult>({
          kind: "mcp",
          pendingId: pending.change.id,
          origin: { ...origin },
          payload: params.request,
          expected: {
            chartFingerprint: params.expectedChartFingerprint,
            diskSnapshot: current.diskSnapshot,
            generation: current.generation,
          },
          run: async () => {
            const value = await options.transaction.apply(params.request, {
              expectedChartFingerprint: params.expectedChartFingerprint,
              origin,
            });
            return {
              status: "accepted",
              value,
              revisions:
                value.status === "committed"
                  ? { chartFingerprint: value.afterFingerprint }
                  : undefined,
            };
          },
        });
        return transactionResponse(queued, options.state, params.expectedChartFingerprint);
      } finally {
        pending.release();
      }
    }

    return failure("method_not_allowed", current, `MCP method is not available: ${request.method}`);
  };

  return Object.freeze({ handle });
}
