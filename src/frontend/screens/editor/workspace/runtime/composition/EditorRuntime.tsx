/**
 * Owns the React seam for the editor's long-lived runtime objects.
 *
 * The imperative composition root still constructs these objects. This module
 * only makes their stable identity available to the React tree and publishes the
 * narrow chrome contract; the provider tree owns the runtime disposal seam
 * without creating another mutable singleton.
 */
import { createContext, useContext, useState, useSyncExternalStore, type ReactNode } from "react";
import { createValue, type ValueCell } from "../../../../../../core/state/values.ts";
import type { AudioTransport } from "../../../../../../core/media/audio.ts";
import type { TauriDocumentStore } from "../../../../../../core/platform/desktop/documentStore.ts";
import type { EditorSession } from "../../../../../../core/edit/session/session.ts";
import type { ResourceScope } from "../../../../../../core/utils/resourceScope.ts";
import type { Preview } from "../../preview/scene/preview.ts";
import type { Timeline } from "../../timeline/surface/timeline.ts";
import type { EditorUiState } from "./editorUiState.ts";
import type { EditorSessionRuntime } from "../providers/SessionProvider.tsx";
import type { PreviewRuntime } from "../providers/PreviewProvider.tsx";
import type { TimelineRuntime } from "../providers/TimelineProvider.tsx";
import type { PlaybackRuntime } from "../providers/PlaybackProvider.tsx";
import type { InspectorRuntime } from "../providers/InspectorProvider.tsx";
import type { DocumentRuntime } from "../providers/DocumentProvider.tsx";
import { EditorHostProvider } from "../../../../../contracts/editorHostReact.tsx";

/** The feature runtimes shared by the React providers of one editor mount. */
export interface EditorProviderRuntimes {
  readonly session: EditorSessionRuntime;
  readonly preview: PreviewRuntime;
  readonly timeline: TimelineRuntime;
  readonly playback: PlaybackRuntime;
  readonly inspector: InspectorRuntime;
  readonly document: DocumentRuntime;
}

/** Stable handle to the mounted editor's services and provider runtimes. */
export interface EditorRuntime {
  /** The current session; chart replacement changes the value behind this getter. */
  readonly session: EditorSession;
  readonly timeline: Timeline;
  readonly audio: AudioTransport;
  readonly preview: Preview;
  readonly scope: ResourceScope;
  readonly documents: TauriDocumentStore | null;
  readonly ui: EditorUiState;
  readonly providers: EditorProviderRuntimes;
  getSession(): EditorSession;
  dispose(): void;
}

/** The live services and teardown hook the runtime exposes to the React tree. */
export interface EditorRuntimeDependencies {
  getSession(): EditorSession;
  timeline: Timeline;
  audio: AudioTransport;
  preview: Preview;
  scope: ResourceScope;
  documents: TauriDocumentStore | null;
  ui: EditorUiState;
  providers: EditorProviderRuntimes;
  dispose(): void;
}

/** Create the stable runtime object once, while keeping session replacement live. */
export function createEditorRuntime(deps: EditorRuntimeDependencies): EditorRuntime {
  return Object.freeze({
    get session() {
      return deps.getSession();
    },
    getSession: deps.getSession,
    timeline: deps.timeline,
    audio: deps.audio,
    preview: deps.preview,
    scope: deps.scope,
    documents: deps.documents,
    ui: deps.ui,
    providers: deps.providers,
    dispose: deps.dispose,
  });
}

const EditorRuntimeContext = createContext<EditorRuntime | null | undefined>(undefined);

/** Publishes the mounted runtime to descendants, or null before it exists. */
export function EditorRuntimeProvider({
  runtime,
  children,
}: {
  runtime: EditorRuntime | null;
  children: ReactNode;
}) {
  return (
    <EditorRuntimeContext.Provider value={runtime}>
      <EditorHostProvider runtime={runtime}>{children}</EditorHostProvider>
    </EditorRuntimeContext.Provider>
  );
}

/** Read the mounted runtime, or null while the backend/editor is not ready. */
export function useEditorRuntime(): EditorRuntime | null {
  const runtime = useContext(EditorRuntimeContext);
  if (runtime === undefined) {
    throw new Error("useEditorRuntime must be used inside EditorRuntimeProvider");
  }
  return runtime;
}

/** Subscribe to a per-runtime UI cell without making pre-mount views special cases. */
export function useEditorRuntimeValue<T>(
  select: (runtime: EditorRuntime) => ValueCell<T>,
  initial: T,
): T {
  const [fallback] = useState(() => createValue<T>({ initial }));
  const runtime = useEditorRuntime();
  const cell = runtime ? select(runtime) : fallback;
  return useSyncExternalStore(cell.subscribe, cell.get, cell.get);
}
