/**
 * Owns the bounded diagnostics contract exposed to extensions and smoke clients.
 *
 * The snapshot is structured and redacted. Detailed backend tracing is opt-in,
 * remains in a fixed-size ring buffer, and exposes no DOM, path, body, or error
 * message data.
 */
import {
  backendTraceEnabled,
  clearBackendTrace,
  setBackendTraceEnabled,
} from "../diagnostics/backendTrace.ts";
import { captureDiagnosticsSnapshot } from "../diagnostics/snapshot.ts";

/** Explicit controls for the bounded local-service trace. */
const trace = Object.freeze({
  /** Whether backend tracing is currently recording. */
  enabled: (): boolean => backendTraceEnabled(),
  /** Enable or disable trace recording. */
  setEnabled: (enabled: boolean): void => setBackendTraceEnabled(enabled),
  /** Drop every buffered trace entry. */
  clear: (): void => clearBackendTrace(),
});

/** Host diagnostics exposed to extensions and smoke clients. */
export const diagnostics = Object.freeze({
  /** Capture the current structured, redacted snapshot. */
  snapshot: captureDiagnosticsSnapshot,
  /** Explicit controls for the local-service trace. */
  trace,
});

export type {
  BackendTraceEntry,
  BackendTraceSnapshot,
  DiagnosticsBackend,
  DiagnosticsDocument,
  DiagnosticsPlayback,
  DiagnosticsPlaybackMetrics,
  DiagnosticsPlaybackState,
  DiagnosticsReadiness,
  DiagnosticsSnapshot,
  DiagnosticsValue,
} from "../diagnostics/snapshot.ts";
