/**
 * Pure availability rules for shortcut scopes.
 *
 * The dispatcher supplies a context snapshot for each key press; this module
 * answers whether a scope may run and which scope wins when two commands share a
 * key. No DOM, z-index, or surface module reads these rules directly.
 */
import type { ShortcutContext, ShortcutScope } from "./types.ts";

/** Higher-priority scopes win when two registered commands share a binding. */
const SCOPE_PRIORITY: Record<ShortcutScope, number> = {
  emergency: 100,
  modal: 90,
  surface: 80,
  editor: 40,
  workspace: 30,
  app: 20,
  instrument: 10,
};

/**
 * Whether a shortcut in `scope` may run in `context`.
 *
 * The rules follow the product matrix: app commands work on every ordinary
 * surface, instrument commands also survive a normal modal, workspace commands
 * need an open document, and editor commands need the edit workspace. Capture and
 * urgent dialogs own the keyboard outright.
 */
export function shortcutScopeAvailable(scope: ShortcutScope, context: ShortcutContext): boolean {
  if (context.capturing) {
    return scope === "emergency";
  }
  if (context.modal === "urgent") {
    return scope === "emergency" || scope === "modal";
  }
  switch (scope) {
    case "emergency":
      return true;
    case "instrument":
      return true;
    case "app":
      return context.modal === "none";
    case "workspace":
      return (
        context.modal === "none" &&
        context.documentOpen &&
        !context.atHome &&
        !context.textEntry &&
        context.surface !== "menu" &&
        context.surface !== "dialog"
      );
    case "editor":
      return (
        context.modal === "none" &&
        context.documentOpen &&
        !context.atHome &&
        !context.textEntry &&
        context.surface !== "menu" &&
        context.surface !== "dialog"
      );
    case "surface":
      return context.modal === "none" && context.surface !== null;
    case "modal":
      return context.modal !== "none";
  }
}

/** The scope's dispatch precedence; larger values win a shared binding. */
export function shortcutScopePriority(scope: ShortcutScope): number {
  return SCOPE_PRIORITY[scope];
}
