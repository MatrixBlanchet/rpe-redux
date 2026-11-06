/**
 * Owns the toolbar API a plugin sees.
 *
 * The registry itself is `core/shell/registries/toolbar.ts`; this is the frozen
 * handle for anyone outside the app. Registered entries are read by the toolbar,
 * its context menus, and the shortcut editor.
 *
 * Minimal usage:
 * ```js
 * const dispose = redux.toolbar.register({
 *   kind: "action",
 *   id: "plugin.ping",
 *   order: 900,
 *   group: "plugin",
 *   label: "Ping",
 *   tooltip: "Run the plugin ping",
 *   icon: "playbackPlay",
 *   run: () => console.log("pong"),
 * });
 * dispose();
 * ```
 */
import {
  actionAvailable,
  actionShortcut,
  actionShortcuts,
  toolbar as toolbarRegistry,
} from "../shell/registries/toolbar.ts";
import type { ToolbarEntry } from "../shell/registries/toolbar.ts";

/** Toolbar entries and action queries exposed to plugins. */
export const toolbar = Object.freeze({
  /** Add one entry; returns its disposer. */
  register: (entry: ToolbarEntry) => toolbarRegistry.register(entry),
  /** Remove one entry by id; true when it existed. */
  unregister: (id: string) => toolbarRegistry.unregister(id),

  /** The current entries in contribution order. */
  get: toolbarRegistry.getSnapshot,
  /** Observe toolbar changes; returns a disposer. */
  subscribe: toolbarRegistry.subscribe,
  /** Read one entry by id. */
  entry: (id: string) => toolbarRegistry.node(id),
  /** Re-evaluate action predicates and notify observers. */
  refresh: toolbarRegistry.refresh,

  /** Whether an action is visible, enabled, and has something to run. */
  available: actionAvailable,
  /** The action's live keyboard bindings. */
  bindings: actionShortcuts,
  /** The primary binding formatted as display text. */
  shortcutText: actionShortcut,
});

export type {
  ActionContext,
  ContextMenuTarget,
  ToolbarAction,
  ToolbarCells,
  ToolbarControl,
  ToolbarDivider,
  ToolbarEntry,
  ToolbarField,
  ToolbarFieldCommon,
  ToolbarNumberField,
  ToolbarRowName,
  ToolbarSelectField,
  ToolbarSpacer,
} from "../shell/registries/toolbar.ts";
