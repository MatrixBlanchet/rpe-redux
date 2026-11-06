/**
 * React binding for the active theme's chrome recipe.
 *
 * Shell hosts subscribe here instead of reading document attributes, so a theme
 * change re-renders the one component that owns the placement decision.
 */
import { useSyncExternalStore } from "react";
import { getThemeChrome, subscribeThemeChrome } from "../../core/theme/chromeState.ts";
import type { ThemeChrome } from "../../core/theme/packages.ts";

/** The chrome recipe currently applied to the document. */
export function useThemeChrome(): ThemeChrome {
  return useSyncExternalStore(subscribeThemeChrome, getThemeChrome, getThemeChrome);
}
