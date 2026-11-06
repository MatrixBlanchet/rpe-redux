/**
 * Owns the shortcut API anyone outside the app sees.
 *
 * Registration only: a shortcut's bindings are values declared by the registry
 * at `shortcut:<id>` and read or written through `core/api/values.ts`. A plugin
 * reads them with `values.byId.get("shortcut:file.save")` and rebinds with
 * `values.byId.set`; the registry's value rule validates every write.
 *
 * Minimal usage:
 * ```js
 * redux.shortcuts.registerCategory({ id: "plugin", title: "Plugin", order: 900 });
 * redux.shortcuts.registerShortcut({
 *   id: "plugin.ping",
 *   category: "plugin",
 *   title: "Plugin ping",
 *   scope: "app",
 *   defaults: [{ key: "P", modifiers: ["CTRL"] }],
 * });
 * ```
 */
import { shortcutRegistry } from "../shortcuts/registry.ts";
import type { ShortcutCategory, ShortcutDefinition } from "../shortcuts/types.ts";

/** Shortcut categories and definitions exposed to plugins. */
export const shortcuts = Object.freeze({
  /** Add a shortcut-editor category; returns its disposer. */
  registerCategory: (category: ShortcutCategory) => shortcutRegistry.registerCategory(category),
  /** Declare a shortcut and its default bindings; returns its disposer. */
  registerShortcut: (definition: ShortcutDefinition) =>
    shortcutRegistry.registerShortcut(definition),
});

export type { ShortcutCategory, ShortcutDefinition, ShortcutDisposer } from "../shortcuts/types.ts";
