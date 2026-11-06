/**
 * Mounts the trajectory form chosen by the panel model.
 *
 * The revision is the React key, so each published snapshot resets the form.
 */
import { createElement } from "react";
import { useEditorRuntimeValue } from "../../workspace/runtime/composition/EditorRuntime.tsx";
import type { TrajectoryPanelSnapshot } from "./model.ts";

/** Mounts the published trajectory form. */
export function TrajectoryInspector() {
  const trajectoryPanel = useEditorRuntimeValue(
    (runtime) => runtime.ui.trajectoryPanel,
    null as TrajectoryPanelSnapshot | null,
  );
  return (
    <div id="trajectory-editor">
      {trajectoryPanel &&
        createElement(trajectoryPanel.component, {
          ...trajectoryPanel.props,
          key: trajectoryPanel.revision,
        })}
    </div>
  );
}
