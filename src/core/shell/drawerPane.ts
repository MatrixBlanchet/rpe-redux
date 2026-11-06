/**
 * Reads the drawer pane selected by the frontend that owns the drawer state.
 *
 * The drawer's open/pane record lives with the drawer module in the frontend,
 * beside the pane registry it validates against and the React surface it
 * publishes to. Core cannot import that module, so the mounted frontend binds a
 * reader here; `workspace.drawerPane()` calls it. There is no second copy of the
 * selection, so the SDK cannot drift from the visible drawer.
 */
import { createLateBound } from "../utils/lateBound.ts";

const selected = createLateBound<() => string>();

/**
 * Bind the mounted drawer's selected-pane reader.
 *
 * Returns a disposer that only clears this binding; a newer drawer keeps its
 * own reader.
 */
export function bindDrawerPaneReader(reader: () => string): () => void {
  return selected.bind(reader);
}

/** The pane selected most recently, or an empty id while no drawer is mounted. */
export function readDrawerPane(): string {
  return selected.value()?.() ?? "";
}
