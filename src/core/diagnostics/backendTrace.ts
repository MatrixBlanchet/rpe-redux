/**
 * Owns the bounded, opt-in observation buffer for local-service requests.
 *
 * The trace records only normalized operation names and transport outcomes.
 * It never retains an origin, path parameters, query strings, request bodies,
 * response bodies, or error messages.
 */

/** One finalized request observation with identifiers removed. */
export interface BackendTraceEntry {
  readonly operation: string;
  readonly elapsedMs: number;
  readonly status: number | null;
  readonly outcome: "success" | "error";
  readonly errorCode?: string;
}

/** Immutable view of the trace state and retained entries. */
export interface BackendTraceSnapshot {
  readonly enabled: boolean;
  readonly capacity: number;
  readonly entries: readonly BackendTraceEntry[];
}

interface BackendTraceResult {
  status: number | null;
  outcome: BackendTraceEntry["outcome"];
  errorCode?: string;
}

interface BackendTraceScope {
  finish(result: BackendTraceResult): void;
}

const CAPACITY = 64;
const entries: BackendTraceEntry[] = [];
let enabled = false;

/** Normalize an HTTP method to a known verb, or `REQUEST` for anything else. */
function safeMethod(method: string): string {
  const normalized = method.toUpperCase();
  return ["GET", "POST", "PUT", "PATCH", "DELETE"].includes(normalized) ? normalized : "REQUEST";
}

/** Collapse a request path to a route name so identifiers never enter the trace. */
function safeRoute(path: string): string {
  const pathname = path.split("?", 1)[0];
  if (pathname === "/api/health") {
    return pathname;
  }
  if (pathname === "/api/projects") {
    return pathname;
  }
  if (pathname === "/api/preferences") {
    return pathname;
  }
  if (/^\/api\/projects\/[^/]+\/revisions$/.test(pathname)) {
    return "/api/projects/:id/revisions";
  }
  if (/^\/api\/projects\/[^/]+$/.test(pathname)) {
    return "/api/projects/:id";
  }
  if (/^\/api\/revisions\/[^/]+$/.test(pathname)) {
    return "/api/revisions/:id";
  }
  return "/api/unknown";
}

/** Convert an internal request path into a stable name without identifiers. */
export function backendTraceOperation(method: string, path: string): string {
  return `${safeMethod(method)} ${safeRoute(path)}`;
}

/** Keep only a valid HTTP status code; everything else is recorded as absent. */
function safeStatus(status: number | null): number | null {
  return typeof status === "number" && Number.isInteger(status) && status >= 0 && status <= 599
    ? status
    : null;
}

/** Reduce an error code to a bounded, log-safe token. */
function safeErrorCode(code: string | undefined): string | undefined {
  if (!code) {
    return undefined;
  }
  const normalized = code
    .toLowerCase()
    .replace(/[^a-z0-9_.:-]/g, "_")
    .slice(0, 48);
  return normalized || "unknown_error";
}

/** Append a frozen entry and drop the oldest one once capacity is reached. */
function append(entry: BackendTraceEntry): void {
  entries.push(Object.freeze(entry));
  if (entries.length > CAPACITY) {
    entries.shift();
  }
}

/** Start one request observation; the returned scope is a no-op while disabled. */
export function beginBackendTrace(method: string, path: string): BackendTraceScope {
  if (!enabled) {
    return { finish: () => undefined };
  }
  const operation = backendTraceOperation(method, path);
  const startedAt = Date.now();
  let finished = false;
  return {
    finish(result): void {
      if (finished) {
        return;
      }
      finished = true;
      append({
        operation,
        elapsedMs: Math.max(0, Date.now() - startedAt),
        status: safeStatus(result.status),
        outcome: result.outcome,
        ...(safeErrorCode(result.errorCode) ? { errorCode: safeErrorCode(result.errorCode) } : {}),
      });
    },
  };
}

/** Turn tracing on or off; entries recorded so far remain in the buffer. */
export function setBackendTraceEnabled(next: boolean): void {
  enabled = next;
}

/** Report whether new request observations are currently recorded. */
export function backendTraceEnabled(): boolean {
  return enabled;
}

/** Drop every retained entry without changing the enabled state. */
export function clearBackendTrace(): void {
  entries.length = 0;
}

/** Copy the current trace state into an immutable snapshot. */
export function backendTraceSnapshot(): BackendTraceSnapshot {
  return Object.freeze({
    enabled,
    capacity: CAPACITY,
    entries: Object.freeze(entries.map((entry) => Object.freeze({ ...entry }))),
  });
}
