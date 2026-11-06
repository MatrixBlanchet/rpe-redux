/**
 * Owns the sidebar registry facade and its host navigation seam.
 *
 * An item is an icon descriptor and an activation callback; React components
 * belong to panel registration. The shell renders the entries. `open` and
 * `close` route through the connected shell so a menu or toolbar action can
 * reveal or dismiss this package's own route without importing the editor.
 */
import { createLateBound } from "../utils/lateBound.ts";
import {
  getSidebarEntry,
  getSidebarItems,
  registerSidebarItem,
  registerSidebarDivider,
  registerSidebarItems,
  subscribeSidebarItems,
  unregisterSidebarEntry,
} from "../shell/registries/sidebar.ts";
import type { SidebarDivider, SidebarItem } from "../shell/registries/sidebar.ts";

/** The shell-side navigation actions behind `sidebar.open` and `sidebar.close`. */
export interface SidebarNavigationHost {
  /** Activate one registered sidebar route; false when the id is not an item. */
  open(id: string): boolean;
  /** Close this route's panel when it is the active inspector; false otherwise. */
  close(id: string): boolean;
}

const navigationHost = createLateBound<SidebarNavigationHost>();

/** Attach the mounted shell navigation adapter. */
export function connectSidebarNavigationHost(host: SidebarNavigationHost): () => void {
  return navigationHost.bind(host);
}

/** Resolve the mounted navigation adapter or fail with a stable message. */
function requireNavigationHost(): SidebarNavigationHost {
  const host = navigationHost.value();
  if (!host) {
    throw new Error("Sidebar navigation host is unavailable");
  }
  return host;
}

/** Sidebar entries exposed to plugins. */
export const sidebar = Object.freeze({
  /** Add one sidebar item; returns its disposer. */
  register: (item: SidebarItem) => registerSidebarItem(item),
  /** Remove one entry by id; true when it existed. */
  unregister: (id: string) => unregisterSidebarEntry(id),
  /** Add a separator; returns its disposer. */
  registerDivider: (divider: SidebarDivider) => registerSidebarDivider(divider),
  /** Add a related set of items under one disposer. */
  registerAll: (items: readonly SidebarItem[]) => registerSidebarItems(items),

  /** Activate one registered sidebar route through the mounted shell. */
  open: (id: string) => requireNavigationHost().open(id),
  /** Close this route's panel only while it is the active inspector pane. */
  close: (id: string) => requireNavigationHost().close(id),

  /** The current items in contribution order, without separators. */
  get: getSidebarItems,
  /** Observe sidebar changes; returns a disposer. */
  subscribe: subscribeSidebarItems,
  /** Read one entry by id, including separators. */
  entry: (id: string) => getSidebarEntry(id),
});

export type {
  SidebarDivider,
  SidebarEntry,
  SidebarIconDescriptor,
  SidebarItem,
} from "../shell/registries/sidebar.ts";
