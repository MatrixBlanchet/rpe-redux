/**
 * Host operating system reported by the desktop host.
 *
 * Chrome that differs per platform asks this once; the browser build has no host
 * and resolves to an empty string.
 */
import { invoke } from "@tauri-apps/api/core";
import { isDesktop } from "../environment.ts";

let pending: Promise<string> | null = null;

/** Resolve the host OS identifier: `windows`, `linux`, or `macos`. */
export function hostPlatform(): Promise<string> {
  if (!pending) {
    pending = isDesktop() ? invoke<string>("host_platform").catch(() => "") : Promise.resolve("");
  }
  return pending;
}
