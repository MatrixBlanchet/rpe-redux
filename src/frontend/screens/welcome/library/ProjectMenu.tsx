/**
 * The context menu for a home-screen project card.
 *
 * The card owns its actions as callbacks. This surface maps them into the
 * shared context-menu rows, so the home menu keeps the same icon, danger ink,
 * disabled state, and row anatomy as every editor menu, then closes before
 * invoking one.
 */
import { useTranslation } from "../../../../i18n/react.ts";
import {
  createContextMenuState,
  type ContextMenuAnchor,
} from "../../../overlays/contextMenu/ContextMenuPopup.tsx";
import { ContextMenuPopup } from "../../../overlays/contextMenu/ContextMenuPopup.tsx";
import {
  ContextMenuRows,
  type ContextMenuRowAction,
} from "../../../overlays/contextMenu/ContextMenuRows.tsx";

/** One command offered by a project card's context menu. */
export interface ProjectMenuAction {
  label: string;
  tooltip: string;
  danger?: boolean;
  run(): void;
}

/** Anchor and commands for the open project context menu. */
export interface ProjectMenuSnapshot extends ContextMenuAnchor {
  owner: HTMLElement;
  actions: readonly ProjectMenuAction[];
}

const projectMenu = createContextMenuState<ProjectMenuSnapshot>();
/** The shared project menu store that cards open. */
export const projectMenuStore = projectMenu;
export const setProjectMenuSnapshot = projectMenu.set;

/** Renders the menu's actions and closes the popup before running one. */
function ProjectMenuItems({
  snapshot,
  close,
}: {
  snapshot: ProjectMenuSnapshot;
  close: () => void;
}) {
  const { tRaw } = useTranslation();
  const actions: ContextMenuRowAction[] = snapshot.actions.map((action, index) => ({
    id: `project:${index}`,
    label: tRaw(action.label),
    tooltip: action.tooltip,
    danger: action.danger,
    enabled: () => snapshot.owner.isConnected,
    run: action.run,
  }));
  return <ContextMenuRows actions={actions} close={close} />;
}

/** The right-click menu of a library project card. */
export function ProjectMenu() {
  const { t } = useTranslation();
  return (
    <ContextMenuPopup store={projectMenuStore} label={t("workspace.welcome.menu.label")}>
      {(snapshot, close) => <ProjectMenuItems snapshot={snapshot} close={close} />}
    </ContextMenuPopup>
  );
}
