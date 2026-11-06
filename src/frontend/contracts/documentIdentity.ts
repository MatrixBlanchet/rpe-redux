/**
 * Derived identity of the open chart document, shared by the editor shell and chrome.
 *
 * The session owns the chart and its read-only flags, editor visibility owns the
 * open/dirty state, and the document runtime owns the path and library binding.
 * This module turns those live sources into one display model for the title bar
 * and status bar, without storing a second copy of any of them. It lives in the
 * frontend contracts so persistent chrome can read the model without importing
 * the editor screen.
 */

/** Where the displayed document title came from. */
export type DocumentTitleSource = "metadata" | "file" | "untitled";

/** Persistence state shown for the open document. */
export type DocumentSaveState = "none" | "saved" | "unsaved" | "saving";

/** Editing authority shown for the open document. */
export type DocumentAccess = "editable" | "read-only" | "collaboration" | "collaboration-viewer";

/** Live values the identity selector reads. */
export interface DocumentIdentitySource {
  open: boolean;
  metadataName?: unknown;
  chartName?: string | null;
  path?: string | null;
  dirty?: boolean;
  saving?: boolean;
  documentReadOnly?: boolean;
  collaborationActive?: boolean;
  collaborationReadOnly?: boolean;
  libraryProject?: boolean;
}

/** Display model shared by the title bar and status bar. */
export interface DocumentIdentity {
  readonly open: boolean;
  /** The chart's own name, or the file stem when metadata has no name. */
  readonly title: string;
  readonly titleSource: DocumentTitleSource;
  /** The chart file name as the document runtime reports it. */
  readonly fileName: string;
  readonly path: string | null;
  readonly libraryProject: boolean;
  readonly dirty: boolean;
  readonly saving: boolean;
  readonly saveState: DocumentSaveState;
  readonly access: DocumentAccess;
  readonly readOnly: boolean;
  readonly collaboration: "none" | "active" | "viewer";
}

/** Trimmed text for a value of unknown type, or the empty string. */
function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** The last path segment without its extension. */
function fileStem(value: string): string {
  const last = value.split(/[\\/]/).at(-1) ?? "";
  return last.replace(/\.[^.]+$/, "");
}

/** Projects live document state into the chrome's display model. */
export function selectDocumentIdentity(source: DocumentIdentitySource): DocumentIdentity {
  const open = source.open === true;
  const fileName = text(source.chartName);
  const metadataTitle = text(source.metadataName);
  const fileTitle = fileStem(fileName);
  const title = metadataTitle || fileTitle;
  const titleSource: DocumentTitleSource = metadataTitle
    ? "metadata"
    : fileTitle
      ? "file"
      : "untitled";
  const collaboration = !open
    ? "none"
    : !source.collaborationActive
      ? "none"
      : source.collaborationReadOnly
        ? "viewer"
        : "active";
  const access: DocumentAccess = !open
    ? "editable"
    : collaboration === "viewer"
      ? "collaboration-viewer"
      : source.documentReadOnly === true
        ? "read-only"
        : collaboration === "active"
          ? "collaboration"
          : "editable";
  const dirty = open && source.dirty === true;
  const saving = open && source.saving === true;
  return {
    open,
    title: open ? title : "",
    titleSource: open ? titleSource : "untitled",
    fileName: open ? fileName : "",
    path: open ? text(source.path) || null : null,
    libraryProject: open && source.libraryProject === true,
    dirty,
    saving,
    saveState: !open ? "none" : saving ? "saving" : dirty ? "unsaved" : "saved",
    access,
    readOnly: access === "read-only" || access === "collaboration-viewer",
    collaboration,
  };
}

/**
 * Formats the native window title as `<name> — <app>`.
 *
 * The unsaved mark follows the document name so a taskbar shows the name first
 * and the transient state second.
 */
export function formatDocumentWindowTitle(name: string, dirty: boolean, appName: string): string {
  const documentName = name.trim();
  return documentName ? `${documentName}${dirty ? " *" : ""} — ${appName}` : appName;
}
