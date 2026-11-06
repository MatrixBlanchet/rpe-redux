/**
 * The stage's batch-control host; runtime state and actions arrive from the
 * editor context, and rendering stays in `BatchControlsView`.
 */
import {
  useEditorRuntime,
  useEditorRuntimeValue,
} from "../../runtime/composition/EditorRuntime.tsx";
import { BatchControlsView } from "./BatchControlsView.tsx";

export function BatchControlsOverlay() {
  const runtime = useEditorRuntime();
  const state = runtime?.ui.batchControls ?? null;
  const actions = useEditorRuntimeValue((runtime) => runtime.ui.batchControls.actions, null);
  return (
    <div id="batch-controls-host" className="batch-controls-host">
      {actions && state && <BatchControlsView actions={actions} state={state} />}
    </div>
  );
}
