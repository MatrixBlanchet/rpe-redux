/**
 * Owns direct workspace actions for extensions and automation.
 *
 * The window has one authoring surface: the editor. Document-wide pages open in
 * the drawer, and its selection is the one piece of shell state this handle
 * exposes; the mounted frontend owns it and supplies a reader. Document and
 * inspector operations are supplied by the mounted frontend as well.
 */
import { availabilityFor } from "./support.ts";
import type { ApiAvailability } from "./contract.ts";
import { createLateBound } from "../utils/lateBound.ts";
import { readDrawerPane } from "../shell/drawerPane.ts";
import { openDrawer } from "../shell/drawerOpen.ts";

/** Host operations supplied by the mounted editor workspace. */
export interface WorkspaceHost {
  /** Create a new chart document. */
  newChart(): void;
  /** Open one inspector pane; false when the pane id is unknown. */
  openInspector(id: string): boolean;
}

/** The mounted workspace runtime, or null while unbound. */
const host = createLateBound<WorkspaceHost>();

/**
 * Bind the mounted workspace runtime.
 *
 * Returns a disposer that clears this binding without affecting a newer one.
 */
export function connectWorkspaceApi(value: WorkspaceHost): () => void {
  return host.bind(value);
}

/** Drawer navigation and document actions exposed to plugins. */
export const workspace = Object.freeze({
  /** Report whether an editor workspace runtime is connected. */
  availability(): ApiAvailability {
    return availabilityFor(host.value(), "No editor workspace runtime connected");
  },
  /** The drawer pane selected most recently. */
  drawerPane: (): string => readDrawerPane(),
  /**
   * Open one registered drawer pane.
   *
   * The mounted drawer validates the id and publishes the open/pane record, so a
   * caller never changes a hidden state. A blank id, an unmounted drawer, or an
   * unknown pane returns false and leaves the selection untouched.
   */
  openDrawerPane: (id: string): boolean => {
    const value = id.trim();
    return Boolean(value) && openDrawer(value);
  },
  /** Create a new chart; false when no runtime is connected. */
  newChart: (): boolean => {
    const create = host.value()?.newChart;
    create?.();
    return create !== undefined;
  },
  /** Open one inspector pane; false when no runtime or no such pane. */
  openInspector: (id: string): boolean => host.value()?.openInspector(id) ?? false,
});

/** The public workspace handle: drawer navigation plus document actions. */
export type WorkspaceApi = typeof workspace;
