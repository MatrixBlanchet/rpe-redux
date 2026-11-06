/**
 * The shell's late-bound drawer opener.
 *
 * The drawer lives in the frontend, but the core-side workspace handle needs to
 * ask it to open a pane. Rather than reach across that boundary, the drawer
 * registers one function here at import time and the handle calls it.
 */
import { createLateBound } from "../utils/lateBound.ts";

/** Opens one pane in the drawer, returning false when none is mounted or known. */
const opener = createLateBound<(id: string) => boolean>();

/** Bind the mounted drawer's open function; returns a disposer. */
export function bindDrawerOpener(fn: (id: string) => boolean): () => void {
  return opener.bind(fn);
}

/** Ask the drawer to open a pane; false when the drawer is unavailable. */
export function openDrawer(id: string): boolean {
  return opener.value()?.(id) ?? false;
}
