/**
 * Verifies the shipped theme icon sets without rasterising them.
 *
 * The catalog in `iconAssets.ts`, the two package manifests, and the PNG files
 * on disk have to describe the same names and paths. Every shipped glyph must be
 * a 192×192 PNG; SVG is a build source only and must not leak into a theme.
 *
 * Usage:
 *   npm run icons:check
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("../", import.meta.url)));
const CATALOG = join(ROOT, "src", "design", "components", "icon", "iconAssets.ts");
const THEMES = ["dark", "light"];
const ICON_SIZE = 192;

/** Read the name/path pairs from the icon catalog literal. */
function catalog() {
  const text = readFileSync(CATALOG, "utf8");
  const entries = [...text.matchAll(/^\s*(\w+):\s*"([^"]+)",?$/gm)].map(([, name, path]) => [
    name,
    path,
  ]);
  if (!entries.length) {
    throw new Error(`No icon entries found in ${CATALOG}`);
  }
  return entries;
}

/** List every file below a directory as a forward-slash relative path. */
function walk(directory, base = directory) {
  const found = [];
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) {
      found.push(...walk(path, base));
    } else {
      found.push(relative(base, path).replaceAll("\\", "/"));
    }
  }
  return found;
}

/** Fail unless the file is a PNG of the required icon size. */
function assertPng(path) {
  const bytes = readFileSync(path);
  if (
    bytes.length < 24 ||
    bytes[0] !== 0x89 ||
    bytes.toString("ascii", 1, 4) !== "PNG" ||
    bytes.toString("ascii", 12, 16) !== "IHDR"
  ) {
    throw new Error(`Icon is not a PNG: ${path}`);
  }
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  if (width !== ICON_SIZE || height !== ICON_SIZE) {
    throw new Error(`Icon must be ${ICON_SIZE}×${ICON_SIZE}: ${path} (${width}×${height})`);
  }
}

const entries = catalog();
const expected = new Map(entries.map(([name, path]) => [name, path.replace(/^icons\//, "")]));
const expectedPaths = new Set(expected.values());

for (const theme of THEMES) {
  const root = join(ROOT, "src", "assets", "themes", theme, "icons");
  const directories = readdirSync(root).filter((entry) =>
    statSync(join(root, entry)).isDirectory(),
  );
  if (directories.length) {
    throw new Error(`Theme ${theme} icons must be flat: ${directories.join(", ")}`);
  }
  const kebab = readdirSync(root).filter((entry) => entry.includes("-"));
  if (kebab.length) {
    throw new Error(`Theme ${theme} icons must use snake_case: ${kebab.join(", ")}`);
  }
  const manifest = JSON.parse(
    readFileSync(join(ROOT, "src", "assets", "themes", theme, "package.json"), "utf8"),
  );
  if (Object.keys(manifest.icons ?? {}).length !== entries.length) {
    throw new Error(`Theme ${theme} icon map does not match the catalog`);
  }
  for (const [name, path] of entries) {
    if (manifest.icons?.[name] !== path) {
      throw new Error(`Theme ${theme} maps ${name} to ${manifest.icons?.[name] ?? "nothing"}`);
    }
    assertPng(join(root, expected.get(name)));
  }
  const files = walk(root);
  const extra = files.filter((file) => !expectedPaths.has(file) || !file.endsWith(".png"));
  if (extra.length) {
    throw new Error(`Theme ${theme} contains unreferenced or non-PNG icons: ${extra.join(", ")}`);
  }
}

// The two packages are an optical pair, not two names for one byte-identical
// mask. A copied set would silently lose the light/dark stroke adjustment.
for (const path of expectedPaths) {
  const dark = readFileSync(join(ROOT, "src", "assets", "themes", "dark", "icons", path));
  const light = readFileSync(join(ROOT, "src", "assets", "themes", "light", "icons", path));
  if (dark.equals(light)) {
    throw new Error(`Theme icon is identical in both appearances: ${path}`);
  }
}

console.log(`PASS icons: ${entries.length} names, ${THEMES.length} themes, ${ICON_SIZE}px PNG`);
