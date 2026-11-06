/**
 * Shared staging for the portable desktop payload.
 *
 * The local build uses the staged folder as the portable product; the release
 * pipeline uses the same layout, without the portable marker, as the signed
 * in-place update payload.
 */
import { cpSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** Copy one required build input, failing with its path when it is absent. */
function copyRequired(source, destination) {
  if (!existsSync(source)) {
    throw new Error(`Portable build input is missing: ${source}`);
  }
  cpSync(source, destination, { recursive: true });
}

/** Resolve the executable, sidecar, and resource roots for one Rust target. */
export function portableTarget(root, target = process.env.CARGO_BUILD_TARGET) {
  const targetDirectory = target
    ? join(root, "src-tauri", "target", target, "release")
    : join(root, "src-tauri", "target", "release");
  const targetPlatform = target
    ? target.includes("windows")
      ? "windows"
      : target.includes("linux")
        ? "linux"
        : "other"
    : process.platform === "win32"
      ? "windows"
      : process.platform === "linux"
        ? "linux"
        : "other";
  const windowsTarget = targetPlatform === "windows";
  return {
    targetDirectory,
    targetPlatform,
    windowsTarget,
    desktopTarget: windowsTarget || targetPlatform === "linux",
    executableName: windowsTarget ? "rpe-redux.exe" : "rpe-redux",
    sidecarName: windowsTarget ? "redux-service.exe" : "redux-service",
  };
}

/**
 * Copy the application files into `packageRoot`.
 *
 * `marker` is false for an update payload: the installed folder already carries
 * its own marker, and a payload must never turn an installation portable.
 */
export function stagePortablePayload({
  root,
  packageRoot,
  target = process.env.CARGO_BUILD_TARGET,
  marker = false,
}) {
  const context = portableTarget(root, target);
  mkdirSync(packageRoot, { recursive: true });
  copyRequired(
    join(context.targetDirectory, context.executableName),
    join(packageRoot, context.executableName),
  );
  for (const directory of ["assets", "themes", "skins", "extensions"]) {
    copyRequired(join(root, "dist", directory), join(packageRoot, directory));
  }
  copyRequired(join(root, "LICENSE"), join(packageRoot, "LICENSE"));
  copyRequired(join(root, "NOTICE"), join(packageRoot, "NOTICE"));
  mkdirSync(join(packageRoot, "resources"), { recursive: true });
  copyRequired(
    join(root, "src-tauri", "resources", context.sidecarName),
    join(packageRoot, "resources", context.sidecarName),
  );
  if (context.desktopTarget) {
    copyRequired(
      join(root, "src-tauri", "resources", "ffmpeg"),
      join(packageRoot, "resources", "ffmpeg"),
    );
    copyRequired(
      join(root, "src-tauri", "resources", "cloudflared"),
      join(packageRoot, "resources", "cloudflared"),
    );
  }
  if (marker) {
    writeFileSync(join(packageRoot, "portable.marker"), "portable\n");
  }
  return context;
}
