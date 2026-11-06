/**
 * The document lifecycle door for extensions and deterministic smoke clients.
 *
 * The contract accepts explicit paths and bytes only: it never opens a native
 * picker and never asks a DOM element to provide document state. The mounted
 * editor supplies the host through `connectDocumentApi`; between editor mounts
 * calls return a structured `unavailable` result.
 */
import { createChart, parseChart, serializeChart, type Chart } from "../../global/chart/chart.ts";
import type { ApiError, ApiErrorCode, ApiResult } from "../../contracts/result.ts";
import { chartFingerprint } from "./chartRevision.ts";
import { createLateBound } from "../../utils/lateBound.ts";

export type DocumentFormat = "memory" | "json" | "pez";
export type DocumentStatus = "empty" | "open";
export type DocumentReplacePolicy = "reject" | "discard";

export interface DocumentState {
  status: DocumentStatus;
  path: string | null;
  name: string;
  format: DocumentFormat;
  dirty: boolean;
  fingerprint: string | null;
}

export interface DocumentSnapshot {
  state: DocumentState;
  chart: Chart | null;
}

export interface DocumentActionOptions {
  replace?: DocumentReplacePolicy;
}

export interface CreateDocumentOptions extends DocumentActionOptions {
  name?: string;
  chart?: Chart;
}

export interface OpenBytesOptions extends DocumentActionOptions {
  name?: string;
}

export interface SaveDocumentOptions {
  /**
   * Explicit export target for in-process host automation and smoke clients.
   *
   * The Extension capability gate drops this field; a package saves only
   * through the host's user-visible flow.
   */
  path?: string;
}

interface DocumentApiHost {
  descriptor(): Pick<DocumentState, "status" | "path" | "name" | "format">;
  /** Cached document revision; avoids a synchronous whole-chart hash on state reads. */
  fingerprint?(): string | null;
  chart(): Chart | null;
  dirty(): boolean;
  create(name: string, chart: Chart): Promise<void>;
  openPath(path: string): Promise<void>;
  openBytes(bytes: Uint8Array, name: string): Promise<"loaded" | "multiple">;
  save(path?: string): Promise<"saved" | "save_conflict">;
  close(): Promise<void>;
}

/**
 * Returns a validated detached copy of a chart, or null.
 *
 * A chart an extension hook left with a back-reference is not serializable; the
 * copy is refused rather than letting the JSON writer throw a raw TypeError.
 */
function cloneChart(chart: Chart | null): Chart | null {
  if (!chart) {
    return null;
  }
  try {
    return parseChart(serializeChart(chart));
  } catch {
    return null;
  }
}

/**
 * A detached copy for a read-only snapshot.
 *
 * The live chart is already validated and normalized, so the native structured
 * clone is preferred; the validated JSON round-trip handles values structured
 * clone cannot copy. A cyclic chart has no detached form; null is the documented
 * empty snapshot.
 */
function detachChart(chart: Chart | null): Chart | null {
  if (!chart) {
    return null;
  }
  try {
    return structuredClone(chart);
  } catch {
    try {
      return parseChart(serializeChart(chart));
    } catch {
      return null;
    }
  }
}

/** Extracts a display message from an unknown thrown value. */
function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Carries a stable API error code through a failed document operation. */
class DocumentOperationError extends Error {
  readonly code: ApiErrorCode;

  /** Creates an error with the API code the facade should return. */
  constructor(code: ApiErrorCode, message?: string) {
    super(message);
    this.code = code;
  }
}

/** Builds the document facade over one host; disposal blocks later calls. */
export function createDocumentApi(host: DocumentApiHost) {
  let disposed = false;
  /** Returns the unavailable error once the host is disposed. */
  const check = (): ApiError | null =>
    disposed ? { code: "unavailable", message: "Editor document runtime is disposed" } : null;

  /** Reads the current document descriptor, dirty flag, and fingerprint. */
  const currentState = (): DocumentState => {
    const descriptor = host.descriptor();
    const source = host.chart();
    return {
      ...descriptor,
      dirty: host.dirty(),
      // Prefer the document coordinator's committed fingerprint. Falling back
      // to the chart cache is safe for hosts that do not expose a revision.
      fingerprint: host.fingerprint ? host.fingerprint() : source ? chartFingerprint(source) : null,
    };
  };
  /** Captures state plus a detached chart copy. */
  const snapshot = (): DocumentSnapshot => {
    return { state: currentState(), chart: detachChart(host.chart()) };
  };

  /** Guards an operation behind disposal and unsaved-change policy, then snapshots. */
  const action = async <T>(
    operation: () => Promise<T>,
    options: DocumentActionOptions = {},
  ): Promise<ApiResult<T>> => {
    const unavailable = check();
    if (unavailable) {
      return { ok: false, error: unavailable };
    }
    if (host.dirty() && options.replace !== "discard") {
      return { ok: false, error: { code: "unsaved_changes" } };
    }
    try {
      return { ok: true, value: await operation() };
    } catch (error) {
      if (error instanceof DocumentOperationError) {
        return {
          ok: false,
          error: {
            code: error.code,
            ...(error.message ? { message: error.message } : {}),
          },
        };
      }
      return { ok: false, error: { code: "failed", message: errorMessage(error) } };
    }
  };

  const api = {
    version: 1,
    state(): DocumentState {
      return currentState();
    },
    snapshot(): Chart | null {
      return snapshot().chart;
    },
    fingerprint(): string | null {
      return currentState().fingerprint;
    },
    create(options: CreateDocumentOptions = {}): Promise<ApiResult<DocumentSnapshot>> {
      const name = options.name?.trim() || "chart.json";
      const chart = options.chart ? cloneChart(options.chart) : createChart();
      if (!chart) {
        return Promise.resolve({
          ok: false,
          error: {
            code: "failed",
            message: "The chart could not be copied; remove cyclic or non-JSON values.",
          },
        });
      }
      return action(async () => {
        await host.create(name, chart);
        return snapshot();
      }, options);
    },
    openPath(
      path: string,
      options: DocumentActionOptions = {},
    ): Promise<ApiResult<DocumentSnapshot>> {
      const trimmed = path.trim();
      if (!trimmed) {
        return Promise.resolve({ ok: false, error: { code: "invalid_request" } });
      }
      return action(async () => {
        await host.openPath(trimmed);
        return snapshot();
      }, options);
    },
    openBytes(
      bytes: Uint8Array,
      options: OpenBytesOptions = {},
    ): Promise<ApiResult<DocumentSnapshot>> {
      if (!(bytes instanceof Uint8Array) || bytes.byteLength === 0) {
        return Promise.resolve({ ok: false, error: { code: "invalid_request" } });
      }
      const name = options.name?.trim() || "chart.json";
      return action(async () => {
        const result = await host.openBytes(bytes, name);
        if (result === "multiple") {
          throw new DocumentOperationError("multiple_candidates");
        }
        return snapshot();
      }, options);
    },
    save(options: SaveDocumentOptions = {}): Promise<ApiResult<DocumentSnapshot>> {
      const unavailable = check();
      if (unavailable) {
        return Promise.resolve({ ok: false, error: unavailable });
      }
      const current = currentState();
      if (current.status === "empty") {
        return Promise.resolve({ ok: false, error: { code: "invalid_request" } });
      }
      // A memory/library document has no path and still saves to the library.
      // A path is an explicit export destination for host automation; the
      // Extension-facing facade drops it before this method runs.
      return action(
        async () => {
          const result = await host.save(options.path?.trim());
          if (result === "save_conflict") {
            throw new DocumentOperationError("save_conflict");
          }
          return snapshot();
        },
        { replace: "discard" },
      );
    },
    close(options: DocumentActionOptions = {}): Promise<ApiResult<DocumentSnapshot>> {
      return action(async () => {
        await host.close();
        return snapshot();
      }, options);
    },
    dispose(): void {
      disposed = true;
    },
  };
  return api;
}

export type DocumentApi = ReturnType<typeof createDocumentApi>;

const documentApiBinding = createLateBound<DocumentApi>();

/** Binds a document host and disposes its facade on teardown. */
export function connectDocumentApi(host: DocumentApiHost): () => void {
  const api = createDocumentApi(host);
  const disconnect = documentApiBinding.bind(api);
  return () => {
    disconnect();
    api.dispose();
  };
}

/** The mounted document facade, or null while no editor is bound. */
export function getDocumentApi(): DocumentApi | null {
  return documentApiBinding.value();
}
