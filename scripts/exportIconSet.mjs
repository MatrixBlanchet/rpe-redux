/**
 * Writes the built-in glyph catalog out as a complete theme package.
 *
 * The package format is one JSON document with a palette, an optional chrome
 * recipe, and an `icons` map. A package that ships beside the app can point at
 * files, but a package meant to be handed to someone else has to carry its
 * artwork, so this export inlines every glyph as a data URL. The result can be
 * edited, re-imported, or dropped into `themes/`.
 *
 * Usage:
 *   node scripts/exportIconSet.mjs [--out=themes] [--id=theme-default]
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("../", import.meta.url)));
const SOURCE = join(ROOT, "src", "design", "components", "icon", "iconAssets.ts");
const PACKAGE_ROOT = join(ROOT, "src", "assets", "themes", "dark");
const THEME_SOURCE = join(PACKAGE_ROOT, "package.json");

/** Read one `--name=value` argument, falling back when it is absent. */
function argument(name, fallback) {
  const prefix = `${name}=`;
  const value = process.argv.find((entry) => entry.startsWith(prefix));
  return value ? value.slice(prefix.length) : fallback;
}

/**
 * The catalog is a literal map in the design system; read it, do not duplicate it.
 * Its paths are written relative to the bundled icon root (`icons/...`), and the
 * flat files now live inside the theme package.
 */
function catalog() {
  const text = readFileSync(SOURCE, "utf8");
  const entries = [...text.matchAll(/^\s*(\w+):\s*"([^"]+)",?$/gm)].map(([, name, path]) => [
    name,
    path.replace(/^redux\//, ""),
  ]);
  if (!entries.length) {
    throw new Error(`No icon entries found in ${SOURCE}`);
  }
  return entries;
}

/** Inline one bundled glyph as a base64 PNG data URL. */
function dataUrl(path) {
  const bytes = readFileSync(join(PACKAGE_ROOT, path));
  return `data:image/png;base64,${bytes.toString("base64")}`;
}

const out = resolve(ROOT, argument("--out", "themes"));
const id = argument("--id", "theme-default");
const icons = Object.fromEntries(catalog().map(([name, path]) => [name, dataUrl(path)]));
const source = JSON.parse(readFileSync(THEME_SOURCE, "utf8"));
const document = {
  schemaVersion: 2,
  kind: "theme",
  id,
  name: "Redux theme (portable)",
  version: source.version ?? "1.0.0",
  author: "RPE Redux",
  appearance: "dark",
  ...(source.chrome ? { chrome: source.chrome } : {}),
  ...(source.ui ? { ui: source.ui } : {}),
  colors: source.colors,
  icons,
};
mkdirSync(out, { recursive: true });
const target = join(out, `${id}.json`);
writeFileSync(target, `${JSON.stringify(document, null, 2)}\n`);
console.log(
  JSON.stringify({ target, icons: Object.keys(icons).length, bytes: readFileSync(target).length }),
);
