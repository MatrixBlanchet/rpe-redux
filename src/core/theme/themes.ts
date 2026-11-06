/**
 * The theme list the settings and the shell ask for.
 *
 * It is a view over the package registry: a theme's identity is its package, and
 * its appearance family is what the rest of the app reads when it needs to know
 * whether it is painting light or dark.
 */
import { getThemePackage, getThemePackages } from "./registry.ts";
import type { ThemeAppearance, ThemeSource } from "./packages.ts";
import type { PackageName } from "../utils/packageName.ts";

/** Stable identifier stored in user preferences. */
export type Theme = string;

/** Package id used when no stored theme resolves. */
export const DEFAULT_THEME: Theme = "dark";

/** Identity and appearance of a selectable theme. */
export interface ThemeDefinition {
  id: Theme;
  name: PackageName;
  appearance: ThemeAppearance;
  source: ThemeSource;
}

/** Return every selectable theme, built-ins first. */
export function getThemes(): readonly ThemeDefinition[] {
  return getThemePackages().map((theme) => ({
    id: theme.id,
    name: theme.name,
    appearance: theme.appearance ?? "dark",
    source: theme.source,
  }));
}

/** Read one theme definition by package id. */
export function getTheme(theme: Theme): ThemeDefinition | undefined {
  const found = getThemePackage(theme);
  return found
    ? {
        id: found.id,
        name: found.name,
        appearance: found.appearance ?? "dark",
        source: found.source,
      }
    : undefined;
}

/**
 * The light/dark family a theme paints, defaulting to dark for an unknown id.
 *
 * Artwork that ships in two inks asks this so the choice follows the surface
 * the user is actually looking at.
 */
export function getThemeAppearance(theme: Theme): ThemeAppearance {
  return getTheme(theme)?.appearance ?? "dark";
}
