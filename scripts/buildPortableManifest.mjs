/**
 * Merge the per-architecture portable update signatures into one signed
 * manifest. Tauri's updater reads this file exactly like `latest.json`, but the
 * payload is the in-place ZIP rather than the NSIS installer.
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

/** Read one `--name=value` or `--name value` argument. */
function argument(name) {
  const index = process.argv.indexOf(`--${name}`);
  if (index >= 0) {
    return process.argv[index + 1];
  }
  const prefix = `--${name}=`;
  return process.argv.find((entry) => entry.startsWith(prefix))?.slice(prefix.length);
}

const repo = (argument("repo") ?? "").trim();
const tag = (argument("tag") ?? "").trim();
const version = (argument("version") ?? tag).trim().replace(/^v/u, "");
const directory = resolve(argument("dir") ?? ".");
const out = resolve(argument("out") ?? "redux-latest.json");
if (!repo || !tag || !version) {
  console.error(
    "Usage: node scripts/buildPortableManifest.mjs --repo=<owner/repo> --tag=<tag> --version=<version> --dir=<signature-dir> [--out=<file>]",
  );
  process.exit(2);
}

const platforms = {
  x64: "windows-x86_64",
  x86: "windows-i686",
  arm64: "windows-aarch64",
};

const entries = {};
for (const name of readdirSync(directory)) {
  const match = /^(.+)_([^_]+)_portable-update\.zip\.sig$/u.exec(name);
  if (!match) {
    continue;
  }
  const platform = platforms[match[2]];
  if (!platform) {
    continue;
  }
  const asset = name.slice(0, -".sig".length);
  const signature = readFileSync(join(directory, name), "utf8").trim();
  entries[platform] = {
    signature,
    url: `https://github.com/${repo}/releases/download/${tag}/${encodeURIComponent(asset)}`,
  };
}

if (!Object.keys(entries).length) {
  console.error(`No portable update signatures found in ${directory}`);
  process.exit(1);
}

const manifest = {
  version,
  notes: argument("notes") ?? "",
  pub_date: argument("date") ?? new Date().toISOString(),
  platforms: entries,
};
writeFileSync(out, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Portable update manifest: ${out}`);
