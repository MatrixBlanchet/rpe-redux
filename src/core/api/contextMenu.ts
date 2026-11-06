/**
 * Owns the right-click menu API a plugin sees.
 *
 * The registry itself is `core/shell/registries/contextMenu.ts`; this is the
 * frozen handle for anyone outside the app. Menu sites read the registered
 * rows through the shared overlay renderer.
 *
 * Minimal usage:
 * ```js
 * const entry = {
 *   id: "plugin.trim",
 *   order: 900,
 *   contexts: ["notes", "events"],
 *   label: "Trim selection",
 *   shortcut: "Ctrl+T",
 *   run: (target) => console.log(target?.surface),
 * };
 * const dispose = redux.contextMenu.register(entry);
 * redux.contextMenu.update({ ...entry, label: "Trim notes" });
 * dispose();
 * ```
 */
import { contextMenu as contextMenuRegistry } from "../shell/registries/contextMenu.ts";
import type { ContextMenuItem } from "../shell/registries/contextMenu.ts";

/** Right-click menu rows and queries exposed to plugins. */
export const contextMenu = Object.freeze({
  /** Add one row; returns its disposer. */
  register: (entry: ContextMenuItem) => contextMenuRegistry.register(entry),
  /** Add a related set of rows under one disposer; the whole batch or none. */
  registerAll: (entries: readonly ContextMenuItem[]) => contextMenuRegistry.registerAll(entries),
  /** Replace one row in place; false when the id is not registered. */
  update: (entry: ContextMenuItem) => contextMenuRegistry.update(entry),
  /** Remove one row by id; true when it existed. */
  unregister: (id: string) => contextMenuRegistry.unregister(id),

  /** The current rows in contribution order. */
  get: contextMenuRegistry.getSnapshot,
  /** Observe registry changes; returns a disposer. */
  subscribe: contextMenuRegistry.subscribe,
  /** Read one row by id. */
  entry: (id: string) => contextMenuRegistry.node(id),
});

export type { ContextMenuItem, ContextMenuSurface } from "../shell/registries/contextMenu.ts";
export type { ContextMenuTarget } from "../shell/registries/toolbar.ts";
