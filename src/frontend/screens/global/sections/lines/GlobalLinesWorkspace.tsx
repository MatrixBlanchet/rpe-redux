/**
 * Judge-line tree workspace for the drawer.
 *
 * The workspace is the selector; the inspector beside it owns the selected
 * line's properties. Both surfaces read the same line-panel controller.
 */
import { useEffect, useSyncExternalStore } from "react";
import { useEditorRuntime } from "../../../editor/workspace/runtime/composition/EditorRuntime.tsx";
import { useEditorSession } from "../../../editor/workspace/runtime/providers/SessionProvider.tsx";
import { useInspectorRuntime } from "../../../editor/workspace/runtime/providers/InspectorProvider.tsx";
import { LinesPanel } from "./LinesPanel.tsx";

/**
 * Renders the judge-line tree and keeps the inspector's line panel in sync with
 * session changes.
 */
export function GlobalLinesWorkspace() {
  const runtime = useEditorRuntime();
  const inspector = useInspectorRuntime();
  const sessionRuntime = useEditorSession();
  // Follow document replacement: the tree and line panel must rebind to the
  // session a document installs later, not the one captured at first mount.
  const session = useSyncExternalStore(
    sessionRuntime.subscribe,
    () => sessionRuntime.current,
    () => sessionRuntime.current,
  );
  useEffect(() => {
    if (!runtime || !inspector) {
      return;
    }
    let frame = 0;
    const render = () => inspector.linePanel.render();
    const schedule = () => {
      if (frame) {
        return;
      }
      frame = requestAnimationFrame(() => {
        frame = 0;
        render();
      });
    };
    render();
    session.addEventListener("change", schedule);
    return () => {
      if (frame) {
        cancelAnimationFrame(frame);
      }
      session.removeEventListener("change", schedule);
    };
  }, [runtime, inspector, session]);
  return <LinesPanel showTitle={false} variant="tree" />;
}
