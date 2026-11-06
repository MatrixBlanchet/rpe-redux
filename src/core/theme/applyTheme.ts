/**
 * Turning a stored theme id into a painted document.
 *
 * The registry owns which packages exist; this module decides what the active
 * one means: a base palette in the package's own appearance family (so a partial
 * light theme stays readable), the package's own colours on top, the light/dark
 * family for `color-scheme`, the chrome recipe, and the glyph overrides that
 * came with it.
 */
import { applyThemeToDocument } from "../platform/browser/themeSurface.ts";
import { setIconOverrides } from "../platform/browser/iconOverrides.ts";
import { PREFERENCE_SECTIONS, preferences } from "../state/preferences.ts";
import { setThemeChrome } from "./chromeState.ts";
import { resolveThemeColors } from "./packages.ts";
import { setThemeUi } from "./uiState.ts";
import { builtinIconFallback, getThemePackage, registerBuiltinThemes } from "./registry.ts";
import { DEFAULT_THEME, type Theme } from "./themes.ts";

/**
 * Read the icon-package override id kept in the icons preference section.
 *
 * The value supplements a theme's own glyphs, so an imported icon package still
 * resolves.
 */
function legacyIconPackageId(): string {
  const stored = preferences.read(PREFERENCE_SECTIONS.icons);
  return typeof stored === "string" ? stored : "";
}

/** Re-applies whatever the preferences currently say. */
export function applyActiveTheme(): void {
  const stored = preferences.read(PREFERENCE_SECTIONS.appearance);
  applyTheme(typeof stored === "string" ? stored : DEFAULT_THEME);
}

/** Apply the selected theme to the document and notify theme-aware controls. */
export function applyTheme(theme: Theme): void {
  registerBuiltinThemes();
  const active = getThemePackage(theme) ?? getThemePackage(DEFAULT_THEME);
  if (!active) {
    return;
  }
  const basePackage =
    getThemePackage(active.appearance === "light" ? "light" : DEFAULT_THEME) ??
    getThemePackage(DEFAULT_THEME);
  const base = basePackage?.colors ?? {};
  applyThemeToDocument(
    resolveThemeColors(base, active.colors, active.actionForeground),
    active.id,
    active.appearance,
    active.chrome,
  );
  setThemeChrome(active.chrome);
  setThemeUi(active.ui);
  // Fill missing names from the reference set for this appearance, then merge
  // the optional icon-package override over the active theme's own glyphs.
  const legacyIcons = getThemePackage(legacyIconPackageId())?.icons ?? {};
  setIconOverrides({
    ...builtinIconFallback(active.appearance),
    ...active.icons,
    ...legacyIcons,
  });
}
