/**
 * React binding for the active theme's declarative UI contribution.
 *
 * Slot and component hosts subscribe here so a theme change re-renders only the
 * surfaces that can be replaced.
 */
import { useSyncExternalStore } from "react";
import { getThemeUi, subscribeThemeUi } from "../../core/theme/uiState.ts";
import type { ThemeUi } from "../../core/theme/ui.ts";

/** The declarative UI currently applied to the document. */
export function useThemeUi(): ThemeUi {
  return useSyncExternalStore(subscribeThemeUi, getThemeUi, getThemeUi);
}
