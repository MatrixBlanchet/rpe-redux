/**
 * Hosts the timeline layer selector in its grid slot and subscribes it to the
 * runtime layer-button snapshot.
 *
 * It owns only that host element; button content and selection behavior come from
 * `LayerButtonsView` and `layerButtons`.
 */
import { useEditorRuntimeValue } from "../../runtime/composition/EditorRuntime.tsx";
import { LayerButtonsView } from "./LayerButtonsView.tsx";

/** Renders the layer selector from the runtime snapshot. */
export function LayerButtonsOverlay() {
  const buttons = useEditorRuntimeValue((runtime) => runtime.ui.layerButtons.snapshot, null);
  return buttons ? <LayerButtonsView {...buttons} /> : null;
}
