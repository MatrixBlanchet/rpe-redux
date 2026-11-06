/**
 * The package registry.
 *
 * A package is a folder under `src/assets/themes/` with a `package.json` document and,
 * for a glyph set, an `icons/` tree beside it. Bundled packages are imported at
 * build time, so their artwork is part of the frontend bundle; external packages
 * are discovered by the desktop host from the `themes/` folder next to the
 * executable and registered here.
 */
import { setBuiltinIcons } from "../platform/browser/iconOverrides.ts";
import { packageName } from "../utils/packageName.ts";
import {
  parseThemePackage,
  type ThemeAppearance,
  type ThemePackage,
  type ThemeSource,
} from "./packages.ts";

const documents = import.meta.glob("../../assets/themes/*/package.json", { eager: true }) as Record<
  string,
  { default?: unknown } | unknown
>;

const iconUrls = import.meta.glob("../../assets/themes/*/icons/*.png", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

const packages = new Map<string, ThemePackage>();
const listeners = new Set<() => void>();
let builtinsLoaded = false;
const fallbackIcons: Partial<Record<ThemeAppearance, Readonly<Record<string, string>>>> = {};

/** Notify every registered listener once per registry change. */
function notify(): void {
  for (const listener of [...listeners]) {
    listener();
  }
}

/** `../../assets/themes/dark/package.json` -> `dark` */
function folderOf(key: string): string {
  return key.split("/").at(-2) ?? "";
}

/** Resolves a package-relative icon path to the URL the bundler emitted. */
function resolveIcons(
  folder: string,
  icons: Readonly<Record<string, string>>,
): Record<string, string> {
  const resolved: Record<string, string> = {};
  for (const [name, path] of Object.entries(icons)) {
    resolved[name] = iconUrls[`../../assets/themes/${folder}/${path}`] ?? path;
  }
  return resolved;
}

/** Subscribe to package additions, removals, and replacements. */
export function subscribeThemePackages(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Add or replace a package and return a disposer that removes it only if this
 * registration is still the installed one.
 */
export function registerThemePackage(theme: ThemePackage): () => void {
  packages.set(theme.id, theme);
  notify();
  return () => {
    if (packages.get(theme.id) === theme) {
      packages.delete(theme.id);
      notify();
    }
  };
}

/** Registers the bundled packages once, before the first paint that needs them. */
export function registerBuiltinThemes(): void {
  if (builtinsLoaded) {
    return;
  }
  builtinsLoaded = true;
  for (const [key, module] of Object.entries(documents)) {
    const value =
      module && typeof module === "object" && "default" in module ? module.default : module;
    const theme = parseThemePackage(value, "builtin");
    if (!theme) {
      continue;
    }
    const folder = folderOf(key);
    const resolved: ThemePackage = { ...theme, icons: resolveIcons(folder, theme.icons) };
    packages.set(theme.id, resolved);
    // Both reference packages publish a complete glyph set for their
    // appearance. A package without icons inherits the set that matches the
    // surface it paints, so a light theme gets the lighter optical weight.
    if (theme.id === "dark" || theme.id === "light") {
      fallbackIcons[theme.appearance] = Object.freeze({ ...resolved.icons });
    }
    if (theme.id === "dark") {
      setBuiltinIcons(fallbackIcons.dark);
    }
  }
  notify();
}

// Registered at import time: `Icon` reads the built-in set during the first
// render, so the glyphs must be available before the theme effect runs.
registerBuiltinThemes();

/**
 * Glyphs to draw when the active package does not cover a name.
 *
 * The appearance selects the optical weight that belongs on that surface;
 * dark remains the fallback for a package that has not declared one.
 */
export function builtinIconFallback(
  appearance: ThemeAppearance = "dark",
): Readonly<Record<string, string>> {
  return fallbackIcons[appearance] ?? fallbackIcons.dark ?? Object.freeze({});
}

/** Every registered package, built-ins first, then by English display name. */
export function getThemePackages(): readonly ThemePackage[] {
  return [...packages.values()].sort(
    (left, right) =>
      Number(right.source === "builtin") - Number(left.source === "builtin") ||
      packageName(left.name, "en").localeCompare(packageName(right.name, "en")),
  );
}

/** Read one package by id, or undefined when it is not registered. */
export function getThemePackage(id: string): ThemePackage | undefined {
  return packages.get(id);
}

/** One package document found on disk, with the root it came from. */
export interface DiscoveredTheme {
  payload: unknown;
  source: ThemeSource;
}

/**
 * Replace the external theme set after a folder scan.
 *
 * Built-in packages always stay; an external package that disappeared from disk
 * is removed so the picker cannot keep offering a package that no longer exists.
 */
export function replaceDiscoveredThemes(entries: readonly DiscoveredTheme[]): void {
  const discovered = entries.flatMap((entry) => {
    const theme = parseThemePackage(entry.payload, entry.source);
    return theme ? [theme] : [];
  });
  const present = new Set(discovered.map((theme) => theme.id));
  for (const [id, theme] of packages) {
    if (theme.source !== "builtin" && !present.has(id)) {
      packages.delete(id);
    }
  }
  for (const theme of discovered) {
    packages.set(theme.id, theme);
  }
  notify();
}
