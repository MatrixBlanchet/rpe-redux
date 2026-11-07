/**
 * Hosts the timeline audio-analysis overlay canvas and hides it from the runtime
 * visibility cell.
 *
 * It only forwards the DOM ref into the shared timeline surface; the graph is
 * painted by `AudioAnalysis`.
 */
import { useEditorRuntimeValue } from "../../runtime/composition/EditorRuntime.tsx";
import { useTimelineDomSurface } from "../surface/TimelineDomSurface.tsx";

/** Hosts the analysis overlay canvas and hides it while the runtime reports no graph. */
export function AudioAnalysisCanvas() {
  const { audioAnalysisOverlay } = useTimelineDomSurface().attach;
  const visible = useEditorRuntimeValue((runtime) => runtime.ui.audioAnalysis, false);
  return (
    <canvas
      className="audio-analysis-overlay"
      ref={audioAnalysisOverlay}
      hidden={!visible}
      aria-hidden="true"
    />
  );
}
