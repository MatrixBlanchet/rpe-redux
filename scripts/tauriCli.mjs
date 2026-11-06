/**
 * The single Tauri CLI entry used by both the desktop development loop and the
 * release builder, so Windows command-shell handling lives in one place.
 */
import { spawnSync } from "node:child_process";
import { join } from "node:path";

/** The platform-specific path of the locally installed Tauri CLI. */
function tauriBinary(root) {
  return join(root, "node_modules", ".bin", process.platform === "win32" ? "tauri.cmd" : "tauri");
}

/** Run the locally installed Tauri CLI and exit on failure. */
export function runTauri(root, args) {
  const windows = process.platform === "win32";
  const command = windows ? (process.env.ComSpec ?? "cmd.exe") : tauriBinary(root);
  const spawnArgs = windows ? ["/d", "/s", "/c", tauriBinary(root), ...args] : args;
  const result = spawnSync(command, spawnArgs, { cwd: root, stdio: "inherit" });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
