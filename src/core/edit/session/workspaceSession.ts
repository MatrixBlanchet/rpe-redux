/**
 * The last workspace session that the next launch may reopen.
 *
 * A session is deliberately small and versioned: the document reference, the
 * playhead and scroll origin, the active line and multi-line selection, and the
 * panel choices that are not already durable settings. The preference store owns
 * persistence; this module only validates the stored shape so a hand-edited or
 * mismatched record cannot drive the editor with invalid indices.
 */
import { PREFERENCE_SECTIONS, readPreference, writePreference } from "../../state/preferences.ts";
import { isRecord } from "../../utils/guards.ts";
import type { MultiLineMode } from "./session.ts";
import type { MultiLineScroll, MultiLineZoom } from "../timeline/types.ts";

/** The only session layout this build writes or accepts. */
export const WORKSPACE_SESSION_VERSION = 1;

export interface WorkspaceSessionDocument {
  kind: "path" | "project";
  /** Absolute chart path for a file-backed document. */
  path?: string;
  /** SQLite project id for a library-backed document. */
  id?: string;
  /** Display name used when the document has no path. */
  name?: string;
}

export interface WorkspaceSessionView {
  /** Chart time, excluding the chart metadata offset. */
  playheadSeconds: number;
  /** Top visible beat of the main timeline. */
  originBeat: number;
  lineIndex: number;
  multiLine: {
    enabled: boolean;
    mode: MultiLineMode;
    merge: boolean;
    indices: number[];
  };
  multiLineScroll?: number | MultiLineScroll;
  multiLineZoom?: MultiLineZoom;
}

export interface WorkspaceSessionPanels {
  /** Registered inspector pane id; an empty string means closed. */
  activeInspector: string;
  chartInfoExpanded: boolean;
  /** Drawer pane showing when the session was saved; absent means closed. */
  drawerPane?: string;
  /** Whether the drawer was widened when the session was saved. */
  drawerOpen?: boolean;
}

export interface WorkspaceSession {
  version: typeof WORKSPACE_SESSION_VERSION;
  savedAt: number;
  documentRef: WorkspaceSessionDocument;
  view: WorkspaceSessionView;
  panels: WorkspaceSessionPanels;
}

/** Reads a finite number, falling back for other values. */
const finite = (value: unknown, fallback = 0): number =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

/** Reads an integer, falling back for other values. */
const integer = (value: unknown, fallback = 0): number =>
  Number.isInteger(value) ? (value as number) : fallback;

/** Reads a boolean, falling back for other values. */
const boolean = (value: unknown, fallback: boolean): boolean =>
  typeof value === "boolean" ? value : fallback;

/** Reads a string, returning an empty string for other values. */
const string = (value: unknown): string => (typeof value === "string" ? value : "");

/** Validates a stored document reference and its required path or id. */
function readDocument(value: unknown): WorkspaceSessionDocument | null {
  if (!isRecord(value)) {
    return null;
  }
  const kind = value.kind;
  if (kind !== "path" && kind !== "project") {
    return null;
  }
  const path = string(value.path);
  const id = string(value.id);
  if (kind === "path" && !path) {
    return null;
  }
  if (kind === "project" && !id) {
    return null;
  }
  return {
    kind,
    path: path || undefined,
    id: id || undefined,
    name: string(value.name) || undefined,
  };
}

/** Validates the multi-line flag, mode, merge flag, and sorted line indices. */
function readMultiLine(value: unknown): WorkspaceSessionView["multiLine"] {
  if (!isRecord(value)) {
    return { enabled: false, mode: "notes", merge: true, indices: [] };
  }
  const indices = Array.isArray(value.indices)
    ? [...new Set(value.indices.filter((entry): entry is number => Number.isInteger(entry)))]
        .filter((entry) => entry >= 0)
        .sort((left, right) => left - right)
    : [];
  return {
    enabled: boolean(value.enabled, false),
    mode: value.mode === "events" ? "events" : "notes",
    merge: boolean(value.merge, true),
    indices,
  };
}

/** Reads a per-area or scalar multi-line scroll position. */
function readScroll(value: unknown): WorkspaceSessionView["multiLineScroll"] {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (isRecord(value)) {
    return { notes: finite(value.notes), events: finite(value.events) };
  }
  return undefined;
}

/** Reads per-area multi-line zoom levels, defaulting each to 1. */
function readZoom(value: unknown): WorkspaceSessionView["multiLineZoom"] {
  if (!isRecord(value)) {
    return undefined;
  }
  return { notes: finite(value.notes, 1), events: finite(value.events, 1) };
}

/** Validates playhead, origin, line, and multi-line view state. */
function readView(value: unknown): WorkspaceSessionView {
  const source = isRecord(value) ? value : {};
  return {
    playheadSeconds: Math.max(0, finite(source.playheadSeconds)),
    originBeat: finite(source.originBeat),
    lineIndex: Math.max(0, integer(source.lineIndex)),
    multiLine: readMultiLine(source.multiLine),
    multiLineScroll: readScroll(source.multiLineScroll),
    multiLineZoom: readZoom(source.multiLineZoom),
  };
}

/** Validates inspector, chart-info, and drawer state. */
function readPanels(value: unknown): WorkspaceSessionPanels {
  const source = isRecord(value) ? value : {};
  return {
    activeInspector: string(source.activeInspector),
    chartInfoExpanded: boolean(source.chartInfoExpanded, false),
    drawerPane: string(source.drawerPane) || undefined,
    drawerOpen: boolean(source.drawerOpen, false),
  };
}

/** Read and validate the last session; malformed records are ignored. */
export function readWorkspaceSession(): WorkspaceSession | null {
  const value = readPreference<unknown>(PREFERENCE_SECTIONS.session, null);
  if (!isRecord(value) || value.version !== WORKSPACE_SESSION_VERSION) {
    return null;
  }
  const documentInfo = readDocument(value.documentRef);
  if (!documentInfo) {
    return null;
  }
  return {
    version: WORKSPACE_SESSION_VERSION,
    savedAt: finite(value.savedAt, Date.now()),
    documentRef: documentInfo,
    view: readView(value.view),
    panels: readPanels(value.panels),
  };
}

/** Persist the session; a later launch may reopen it when the setting allows. */
export function writeWorkspaceSession(session: WorkspaceSession): void {
  writePreference(PREFERENCE_SECTIONS.session, session);
}

/** Forget the previous document, for example after an explicit close. */
export function clearWorkspaceSession(): void {
  writePreference(PREFERENCE_SECTIONS.session, null);
}
