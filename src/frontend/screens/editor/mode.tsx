/**
 * Editor surface: the timeline workspace, the object inspector, and the
 * editor-only toolbar controls.
 */
import type { WorkspaceSurfaceDefinition } from "../../app/modeContract.ts";
import { EditorToolbarRows } from "./toolbar/EditorToolbarRows.tsx";
import { InspectorPanel } from "./inspector/InspectorPanel.tsx";
import { Workspace } from "./workspace/container/Workspace.tsx";
import "./toolbar/register.ts";
import "./workspace/recording/recordingSidebar.ts";

export const editorMode: WorkspaceSurfaceDefinition = {
  workspace: Workspace,
  inspector: InspectorPanel,
  sidebar: { label: "chrome.sidebar.label", role: "toolbar" },
  toolbarRows: EditorToolbarRows,
};
