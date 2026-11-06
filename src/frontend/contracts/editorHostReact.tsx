/**
 * React seams for the editor host contract.
 *
 * The editor provider tree publishes its runtime and the derived document
 * identity here. Chrome reads both through these hooks, so a title-bar or
 * transport component never imports the editor's provider modules.
 */
import { createContext, useContext, useState, useSyncExternalStore, type ReactNode } from "react";
import { createValue, type ValueCell } from "../../core/state/values.ts";
import type { EditorHostRuntime } from "./editorHost.ts";
import type { DocumentIdentity } from "./documentIdentity.ts";

const EditorHostContext = createContext<EditorHostRuntime | null | undefined>(undefined);

/** Publishes the mounted editor runtime, or null before the assembly exists. */
export function EditorHostProvider({
  runtime,
  children,
}: {
  runtime: EditorHostRuntime | null;
  children: ReactNode;
}) {
  return <EditorHostContext.Provider value={runtime}>{children}</EditorHostContext.Provider>;
}

/** Read the mounted editor runtime, or null while the editor is not ready. */
export function useEditorHostRuntime(): EditorHostRuntime | null {
  const runtime = useContext(EditorHostContext);
  if (runtime === undefined) {
    throw new Error("useEditorHostRuntime must be used inside EditorHostProvider");
  }
  return runtime;
}

/** Subscribe to a per-runtime UI cell without making pre-mount views special cases. */
export function useEditorHostValue<T>(
  select: (runtime: EditorHostRuntime) => ValueCell<T>,
  initial: T,
): T {
  const [fallback] = useState(() => createValue<T>({ initial }));
  const runtime = useEditorHostRuntime();
  const cell = runtime ? select(runtime) : fallback;
  return useSyncExternalStore(cell.subscribe, cell.get, cell.get);
}

const DocumentIdentityContext = createContext<DocumentIdentity | null | undefined>(undefined);

/** Publishes the open document's display identity to the chrome. */
export function DocumentIdentityHostProvider({
  identity,
  children,
}: {
  identity: DocumentIdentity;
  children: ReactNode;
}) {
  return (
    <DocumentIdentityContext.Provider value={identity}>{children}</DocumentIdentityContext.Provider>
  );
}

/** Reads the identity the editor published for the title bar and status bar. */
export function useDocumentIdentityValue(): DocumentIdentity {
  const identity = useContext(DocumentIdentityContext);
  if (!identity) {
    throw new Error("useDocumentIdentityValue must be used inside DocumentIdentityHostProvider");
  }
  return identity;
}
