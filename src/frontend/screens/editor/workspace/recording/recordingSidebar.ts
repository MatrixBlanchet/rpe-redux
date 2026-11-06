/**
 * Contributes the chart-rendering pane to the editor inspector and its sidebar
 * route. Export is a document-wide action, so it belongs with the inspector
 * routes and leaves the dense editing toolbar to editing tools.
 */
import { registerSidebarDivider } from "../../../../../core/shell/registries/sidebar.ts";
import { isDesktop } from "../../../../../core/platform/environment.ts";
import { registerInspectorPanel } from "../../inspector/controller.ts";
import { registerInspectorSidebar } from "../../inspector/inspectorShell.ts";
import { INSPECTOR_TUTORIALS } from "../../inspector/tutorials.ts";
import { RecordingPanel } from "./RecordingPanel.tsx";

const unregister = isDesktop()
  ? [
      registerInspectorPanel({
        id: "recording",
        component: RecordingPanel,
        label: "editor.recording.title",
        icon: "clapperboard",
        tutorial: INSPECTOR_TUTORIALS.recording,
      }),
      registerInspectorSidebar({
        id: "recording",
        order: 120,
        panelId: "recording",
        icon: "clapperboard",
        label: "editor.recording.title",
        domId: "recording-pane",
      }),
      registerSidebarDivider({ kind: "divider", id: "recording.divider", order: 110 }),
    ]
  : [];

if (import.meta.hot) {
  import.meta.hot.dispose(() => unregister.forEach((dispose) => dispose()));
}
