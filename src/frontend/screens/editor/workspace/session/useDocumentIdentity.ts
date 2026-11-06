/**
 * React binding for the chrome's document identity.
 *
 * The session, visibility cell, project value, and document store already own
 * their state; this hook only joins them and adds change signals for the two
 * runtime fields that do not publish an event: the native document path and an
 * in-flight save.
 */
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { editorProjectId } from "../../../../../core/edit/state/publishedValues.ts";
import {
  getEditorVisibility,
  subscribeToEditorVisibility,
} from "../../../../../core/edit/state/visibility.ts";
import { useEditorRuntime, type EditorRuntime } from "../runtime/composition/EditorRuntime.tsx";
import { useEditorSession } from "../runtime/providers/SessionProvider.tsx";
import { selectDocumentIdentity, type DocumentIdentity } from "./documentIdentity.ts";

const PATH_POLL_MS = 500;
const SAVE_POLL_MS = 200;

/** Polls one primitive runtime value; React only repaints when it changes. */
function usePolledValue<T>(read: () => T, intervalMs: number, enabled: boolean): T {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!enabled) {
        return () => {};
      }
      const timer = window.setInterval(onChange, intervalMs);
      return () => window.clearInterval(timer);
    },
    [enabled, intervalMs],
  );
  return useSyncExternalStore(subscribe, read, read);
}

/** Reads the native path kept by the mounted document store. */
function useDocumentPath(runtime: EditorRuntime | null): string | null {
  return usePolledValue(
    () => runtime?.documents?.current?.path ?? null,
    PATH_POLL_MS,
    runtime !== null,
  );
}

/** Reads whether the document saver currently owns an in-flight save. */
function useDocumentSaving(runtime: EditorRuntime | null): boolean {
  return usePolledValue(
    () => Boolean(runtime?.providers.document.documentSaver.pending),
    SAVE_POLL_MS,
    runtime !== null,
  );
}

/** Subscribes to the live document identity for title-bar and status-bar chrome. */
export function useDocumentIdentity(): DocumentIdentity {
  const runtime = useEditorRuntime();
  const sessionRuntime = useEditorSession();
  const session = useSyncExternalStore(
    sessionRuntime.subscribe,
    () => sessionRuntime.current,
    () => sessionRuntime.current,
  );
  const visibility = useSyncExternalStore(
    subscribeToEditorVisibility,
    getEditorVisibility,
    getEditorVisibility,
  );
  const projectId = useSyncExternalStore(
    editorProjectId.subscribe,
    editorProjectId.get,
    editorProjectId.get,
  );
  const [sessionRevision, setSessionRevision] = useState(0);
  const path = useDocumentPath(runtime);
  const saving = useDocumentSaving(runtime);

  // Room roles and the document read-only flag change through the session's own
  // change event, which does not alter the session object or visibility cell.
  useEffect(() => {
    const refresh = () => setSessionRevision((value) => value + 1);
    session.addEventListener("change", refresh);
    return () => session.removeEventListener("change", refresh);
  }, [session]);

  return useMemo(
    () =>
      selectDocumentIdentity({
        open: visibility.hasDocument,
        metadataName: session.chart.META?.name,
        chartName: runtime?.providers.document.currentChartName() ?? "",
        path,
        dirty: visibility.dirty,
        saving,
        documentReadOnly: session.readOnly,
        collaborationActive: session.collaborationActive,
        collaborationReadOnly: session.collaborationReadOnly,
        libraryProject: Boolean(projectId),
      }),
    [
      path,
      projectId,
      runtime,
      saving,
      session,
      sessionRevision,
      visibility.dirty,
      visibility.hasDocument,
    ],
  );
}
