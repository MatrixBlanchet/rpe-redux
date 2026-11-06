/**
 * Keeps the native window surface in step with the document theme.
 *
 * The WebView background is read from the applied theme's `--surface` token, so
 * a resize does not flash the wrong colour and the native surface follows the
 * same package as the interface.
 */
import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { getThemePackage } from "../../../core/theme/registry.ts";
import type { Theme } from "../../../core/theme/themes.ts";

/**
 * Read the surface colour after `applyTheme` has written the package tokens.
 * The package lookup is only a fallback for callers that run before the document
 * theme exists; it reads the same source rather than a second palette.
 */
function surfaceColor(theme: Theme): string {
  const root = globalThis.document?.documentElement;
  const applied = root ? getComputedStyle(root).getPropertyValue("--surface").trim() : "";
  return applied || getThemePackage(theme)?.colors["--surface"] || "";
}

/** Keep the native WebView surface aligned with the document theme. */
export function syncNativeWindowTheme(theme: Theme): void {
  if (!isTauri()) {
    return;
  }
  const background = surfaceColor(theme);
  if (!background) {
    return;
  }
  try {
    void getCurrentWindow()
      .setBackgroundColor(background)
      .catch(() => undefined);
  } catch {
    // The browser build and early startup can expose no native window yet.
  }
}
