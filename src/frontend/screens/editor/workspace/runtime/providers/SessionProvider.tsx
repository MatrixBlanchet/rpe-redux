/** Owns the replaceable chart session and the editor-wide tempo source. */
import { createContext, useContext, useState, type ReactNode } from "react";
import { EditorSession } from "../../../../../../core/edit/session/session.ts";
import { EditorTempoSource } from "../session/tempoSource.ts";

/** The replaceable editor session and the tempo source bound to it. */
export interface EditorSessionRuntime {
  current: EditorSession;
  readonly tempo: EditorTempoSource;
  replace(next: EditorSession): void;
  /** Notify when a document installs a different session behind `current`. */
  subscribe(listener: () => void): () => void;
}

/** Creates the session holder that survives document replacement. */
export function createEditorSessionRuntime(): EditorSessionRuntime {
  const session = new EditorSession();
  const listeners = new Set<() => void>();
  const runtime: EditorSessionRuntime = {
    current: session,
    tempo: new EditorTempoSource(session.chart.BPMList),
    /** Installs the next session and notifies every subscriber. */
    replace(next) {
      runtime.current = next;
      for (const listener of [...listeners]) {
        listener();
      }
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
  return runtime;
}

const EditorSessionContext = createContext<EditorSessionRuntime | null>(null);

/** Owns one session runtime for the lifetime of the editor mount. */
export function EditorSessionProvider({ children }: { children: ReactNode }) {
  const [runtime] = useState(createEditorSessionRuntime);
  return <EditorSessionContext.Provider value={runtime}>{children}</EditorSessionContext.Provider>;
}

/** Reads the session runtime; throws outside the provider. */
export function useEditorSession(): EditorSessionRuntime {
  const runtime = useContext(EditorSessionContext);
  if (!runtime) {
    throw new Error("useEditorSession must be used inside EditorSessionProvider");
  }
  return runtime;
}
