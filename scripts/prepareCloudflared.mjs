/** Stage a pinned Cloudflare Tunnel client for the desktop build. */
import { createHash } from "node:crypto";
import {
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  copyFileSync,
  chmodSync,
  rmSync,
} from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { join, resolve } from "node:path";

const VERSION = "2026.10.7";
const TARGET = process.env.CARGO_BUILD_TARGET ?? process.platform;
const PLATFORM = TARGET.includes("linux")
  ? "linux"
  : TARGET.includes("windows") || TARGET === "win32"
    ? "windows"
    : null;
if (!PLATFORM) {
  console.log("Cloudflare Tunnel staging supports Windows and Linux targets only; skipping.");
  process.exit(0);
}
// Windows ARM64 reuses the amd64 client through x64 emulation.
const ARCHITECTURE =
  TARGET.startsWith("i686") || TARGET === "ia32"
    ? "386"
    : PLATFORM === "linux" && (TARGET.includes("aarch64") || TARGET === "arm64")
      ? "arm64"
      : "amd64";
const VARIANTS = {
  windows: {
    amd64: {
      file: "cloudflared-windows-amd64.exe",
      hash: "2493dbc168923bb3e59e5e7716f71deced92992eea9acd6e9d74f84ac7751343",
    },
    386: {
      file: "cloudflared-windows-386.exe",
      hash: "88c6b972b410db0e26745f593510d772c825a13c5a2374819e3f13a05b333082",
    },
  },
  linux: {
    amd64: {
      file: "cloudflared-linux-amd64",
      hash: "1f99fb518b83dec2ba8d870a7cc991d82a77e6196295a3d2754ba17ab9f91872",
    },
  },
};
const variant = VARIANTS[PLATFORM]?.[ARCHITECTURE];
if (!variant) {
  throw new Error(`No pinned Cloudflare Tunnel client for ${PLATFORM}/${ARCHITECTURE}.`);
}

const root = resolve(import.meta.dirname, "..");
const executable = PLATFORM === "windows" ? "cloudflared.exe" : "cloudflared";
const cacheDirectory = join(root, ".local-tools", "cloudflared");
const cache = join(
  cacheDirectory,
  `cloudflared-${VERSION}-${ARCHITECTURE}${PLATFORM === "windows" ? ".exe" : ""}`,
);
const target = join(root, "src-tauri", "resources", "cloudflared", executable);
// Keep exactly one platform binary in the staged folder; a stale copy from an
// earlier target would otherwise be bundled next to the new one.
rmSync(
  join(
    root,
    "src-tauri",
    "resources",
    "cloudflared",
    PLATFORM === "windows" ? "cloudflared" : "cloudflared.exe",
  ),
  { force: true },
);
const URL = `https://github.com/cloudflare/cloudflared/releases/download/${VERSION}/${variant.file}`;

/** Stream a file through SHA-256 and return the lowercase hex digest. */
async function hash(path) {
  const digest = createHash("sha256");
  for await (const chunk of createReadStream(path)) {
    digest.update(chunk);
  }
  return digest.digest("hex");
}

if (existsSync(target) && (await hash(target)) === variant.hash) {
  process.exit(0);
}
mkdirSync(join(root, "src-tauri", "resources", "cloudflared"), { recursive: true });
mkdirSync(cacheDirectory, { recursive: true });
if (!existsSync(cache) || (await hash(cache)) !== variant.hash) {
  console.log(`Downloading cloudflared ${VERSION} for ${PLATFORM}/${ARCHITECTURE}...`);
  const response = await fetch(URL);
  if (!response.ok || !response.body) {
    throw new Error(`cloudflared download failed: ${response.status}`);
  }
  const partial = `${cache}.partial`;
  await pipeline(Readable.fromWeb(response.body), createWriteStream(partial));
  if ((await hash(partial)) !== variant.hash) {
    throw new Error("cloudflared download checksum mismatch");
  }
  copyFileSync(partial, cache);
}
copyFileSync(cache, target);
if (PLATFORM !== "windows") {
  chmodSync(target, 0o755);
}
console.log(`Staged cloudflared ${VERSION} (${PLATFORM}/${ARCHITECTURE})`);
