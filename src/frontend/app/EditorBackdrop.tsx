/**
 * The editor's window-wide backdrop.
 *
 * It reads the open chart's cover (or the configured custom image) at the app
 * frame, so the artwork stays behind the title bar, toolbar, panels, and status
 * bar instead of being clipped to the workbench. It is mounted only while the
 * editor is visible; the home page owns its own backdrop.
 */
import { useEffect, useState, useSyncExternalStore } from "react";
import { editorProjectId } from "../../core/edit/state/publishedValues.ts";
import { useEditorHostRuntime } from "../contracts/editorHostReact.tsx";
import { useDocumentRuntime } from "../screens/editor/workspace/runtime/providers/DocumentProvider.tsx";
import {
  getHomeProjectCardsSnapshot,
  subscribeHomeProjectCards,
} from "../screens/welcome/homeProjectCards.ts";
import { CoverBackdrop } from "./CoverBackdrop.tsx";
import { useCustomBackgroundUrl } from "./useCustomBackgroundUrl.ts";

/** Resolve the editor backdrop URL from the custom image or the open chart cover. */
export function EditorBackdrop() {
  const runtime = useEditorHostRuntime();
  const document = useDocumentRuntime();
  const session = runtime?.session ?? null;
  const [, setSessionRevision] = useState(0);
  useEffect(() => {
    if (!session) {
      return;
    }
    const refresh = () => setSessionRevision((value) => value + 1);
    session.addEventListener("change", refresh);
    return () => session.removeEventListener("change", refresh);
  }, [session]);
  // The project id is also the signal that the library binding changed; the
  // document runtime reads the project's background fallback from that binding.
  const projectId = useSyncExternalStore(
    editorProjectId.subscribe,
    editorProjectId.get,
    editorProjectId.get,
  );
  const cards = useSyncExternalStore(
    subscribeHomeProjectCards,
    getHomeProjectCardsSnapshot,
    getHomeProjectCardsSnapshot,
  );
  const customBackgroundUrl = useCustomBackgroundUrl();
  // Read on every render: opening a document installs its assets before the
  // editor becomes visible, and the cover must not stay cached from the frame
  // where the previous document was still empty.
  const coverUrl =
    document?.coverUrl() ||
    cards?.libraryProjects.find((project) => project.id === projectId)?.coverUrl ||
    "";
  return <CoverBackdrop scope="editor" url={customBackgroundUrl || coverUrl} />;
}
