/**
 * Chart metadata as an ordinary inspector page.
 *
 * The form itself is shared with document creation; this frame only supplies the
 * live session and chart the fields edit. It has no list column because metadata
 * is a single form, not a document-wide picker.
 */
import { useEditorRuntime } from "../../workspace/runtime/composition/EditorRuntime.tsx";
import { useGlobalChart } from "../../../global/useGlobalChart.ts";
import { MetadataPanelView } from "../../../global/sections/metadata/MetadataPanelView.tsx";

/** The metadata form bound to the current session chart. */
export function MetadataPanel() {
  const runtime = useEditorRuntime();
  const chart = useGlobalChart();
  if (!runtime || !chart) {
    return null;
  }
  return <MetadataPanelView session={runtime.getSession()} chart={chart} />;
}
