/**
 * The registry's view as the interface reads it.
 *
 * The settings page renders this list, so the hook hands React the registry's
 * own snapshot. A view carries no action callbacks, so there is nothing to
 * project away, and `getSnapshot` rebuilds the array only when something
 * changed — the stable identity `useSyncExternalStore` needs.
 *
 * The plugin API (`core/api/shortcuts.ts`) publishes bindings rather than this
 * list, so everything here is app-internal.
 */
import { useSyncExternalStore } from "react";
import { shortcutRegistry } from "../../../../core/shortcuts/registry.ts";
import type { ShortcutView } from "../../../../core/shortcuts/types.ts";

/**
 * Every registered shortcut with the user's current bindings.
 *
 * The settings page renders from this, so a shortcut registered by a feature it
 * does not know about still appears.
 */
export function useShortcuts(): readonly ShortcutView[] {
  return useSyncExternalStore(
    shortcutRegistry.subscribe,
    shortcutRegistry.getSnapshot,
    shortcutRegistry.getSnapshot,
  );
}
