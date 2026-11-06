/**
 * The stage's trajectory canvas slot; the inspector owns its drawing and the
 * runtime supplies visibility.
 */
import { useEditorRuntimeValue } from "../../runtime/composition/EditorRuntime.tsx";
import { useInspectorSurface } from "../../../inspector/InspectorDomSurface.tsx";

/** Renders the trajectory canvas; visibility comes from the inspector runtime. */
export function TrajectoryOverlay() {
  const { trajectoryOverlay } = useInspectorSurface().attach;
  const visible = useEditorRuntimeValue((runtime) => runtime.ui.trajectoryOverlay, false);
  return (
    <canvas
      id="trajectory-overlay"
      ref={trajectoryOverlay}
      className="trajectory-overlay"
      hidden={!visible}
      aria-hidden="true"
    />
  );
}
