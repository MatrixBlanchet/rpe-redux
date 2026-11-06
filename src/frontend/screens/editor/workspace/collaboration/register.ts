/** Registers the collaboration pane and its editor sidebar route. */
import { collaborationActive } from "../../../../../core/collaboration/ui.ts";
import { registerInspectorPanel } from "../../inspector/controller.ts";
import { registerInspectorSidebar } from "../../inspector/inspectorShell.ts";
import { INSPECTOR_TUTORIALS } from "../../inspector/tutorials.ts";
import { RoomPanel } from "./RoomPanel.tsx";

const disposePanel = registerInspectorPanel({
  id: "collaboration",
  component: RoomPanel,
  label: "workspace.collaboration.title",
  icon: "users",
  tutorial: INSPECTOR_TUTORIALS.collaboration,
});
const disposeSidebar = registerInspectorSidebar({
  id: "collaboration",
  order: 115,
  panelId: "collaboration",
  icon: "users",
  label: "workspace.collaboration.title",
  domId: "collaboration-pane",
  indicator: collaborationActive,
});

const unregister = () => {
  disposeSidebar();
  disposePanel();
};

if (import.meta.hot) {
  import.meta.hot.dispose(unregister);
}
