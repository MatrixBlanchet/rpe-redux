/**
 * Build one signed portable update payload for a Windows desktop release.
 *
 * The staged folder is the same application payload as the portable product,
 * minus its marker and user data. The ZIP is signed with the release updater
 * key so the in-place helper can authenticate it again after the editor exits.
 */
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve, sep } from "node:path";
import { zipSync } from "fflate";
import { stagePortablePayload } from "./portablePayload.mjs";
import { runTauri } from "./tauriCli.mjs";

const root = resolve(import.meta.dirname, "..");

/** Read one `--name=value` or `--name value` argument. */
function argument(name) {
  const index = process.argv.indexOf(`--${name}`);
  if (index >= 0) {
    return process.argv[index + 1];
  }
  const prefix = `--${name}=`;
  return process.argv.find((entry) => entry.startsWith(prefix))?.slice(prefix.length);
}

const target = argument("target") ?? process.env.CARGO_BUILD_TARGET ?? "";
const version = (argument("version") ?? "").trim().replace(/^v/u, "");
if (!version) {
  console.error(
    "Usage: node scripts/packagePortableUpdate.mjs --version=<version> [--target=<rust-target>] [--out=<dir>] [--no-sign]",
  );
  process.exit(2);
}
const architecture = target
  ? target.startsWith("aarch64")
    ? "arm64"
    : target.startsWith("i686")
      ? "x86"
      : "x64"
  : process.arch === "arm64"
    ? "arm64"
    : process.arch === "ia32"
      ? "x86"
      : "x64";
const out = resolve(root, argument("out") ?? join("release", "portable-update"));
const stage = mkdtempSync(join(tmpdir(), "redux-portable-"));
const zipName = `RPE.Redux_${version}_${architecture}_portable-update.zip`;
const zipPath = join(out, zipName);

/** Collect every staged file as a forward-slash relative path. */
function collect(directory) {
  const files = {};
  const pending = [directory];
  while (pending.length) {
    const current = pending.pop();
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) {
        pending.push(path);
      } else if (entry.isFile()) {
        const name = relative(directory, path).split(sep).join("/");
        files[name] = readFileSync(path);
      }
    }
  }
  return files;
}

try {
  mkdirSync(out, { recursive: true });
  stagePortablePayload({ root, packageRoot: stage, target: target || undefined, marker: false });
  if (!statSync(join(stage, "rpe-redux.exe")).isFile()) {
    throw new Error("Portable payload is missing rpe-redux.exe");
  }
  writeFileSync(zipPath, zipSync(collect(stage), { level: 9 }));
  console.log(`Portable update payload: ${zipPath}`);
  if (process.argv.includes("--no-sign")) {
    rmSync(`${zipPath}.sig`, { force: true });
  } else {
    runTauri(root, ["signer", "sign", "--app-version", version, zipPath]);
    console.log(`Signed portable update payload: ${zipPath}.sig`);
  }
} finally {
  rmSync(stage, { recursive: true, force: true });
}
