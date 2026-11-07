/**
 * The stage's line-info slot; the controller publishes whether it is visible and
 * what it says.
 */
import { useEditorRuntimeValue } from "../../runtime/composition/EditorRuntime.tsx";
import type { LineInfoSnapshot } from "./lineInfoController.ts";

/** Renders the published line-info text while it is visible. */
export function LineInfoOverlay() {
  const lineInfo = useEditorRuntimeValue((runtime) => runtime.ui.lineInfo, {
    visible: false,
    text: "",
  } satisfies LineInfoSnapshot);
  return (
    <div className="line-info-overlay" hidden={!lineInfo.visible}>
      {lineInfo.text}
    </div>
  );
}
