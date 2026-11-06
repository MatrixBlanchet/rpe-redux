/**
 * The built-in shortcut categories shared by feature registrations.
 *
 * A category is only the label and order the shortcut editor uses. It is not a
 * toolbar group: no popup and no dispatch table is derived from it.
 */
import type { ShortcutCategory } from "./types.ts";

/** Standard shortcut-editor categories supplied by the application. */
export const SHORTCUT_CATEGORIES = Object.freeze({
  file: { id: "file", title: "shortcuts.category.file", order: 10 },
  editorPlayback: {
    id: "editor.playback",
    title: "shortcuts.category.editorPlayback",
    order: 60,
  },
  workspace: {
    id: "workspace",
    title: "shortcuts.category.workspace",
    order: 80,
  },
  tools: { id: "tools", title: "shortcuts.category.tools", order: 90 },
  developer: { id: "developer", title: "shortcuts.category.developer", order: 110 },
} satisfies Record<string, ShortcutCategory>);
