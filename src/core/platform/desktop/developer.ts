/**
 * Desktop developer capabilities.
 *
 * The host decides whether a packaged build is allowed to expose developer
 * entry points. The browser-side feature can therefore keep its actions and
 * visibility stable while ordinary release builds hide them.
 */
import { invoke } from "@tauri-apps/api/core";
import { createValue } from "../../state/values.ts";
import { isDesktop } from "../environment.ts";

const mode = createValue({ initial: import.meta.env?.DEV ?? false });

/** Read-only developer-mode cell for the shell and action registry. */
export const developerMode = Object.freeze({
  get: mode.get,
  subscribe: mode.subscribe,
});

/** Resolve the host policy before the shell advertises developer controls. */
export async function initializeDeveloperMode(): Promise<boolean> {
  if (!isDesktop()) {
    return mode.get();
  }
  try {
    mode.set(await invoke<boolean>("developer_mode"));
  } catch {
    mode.set(false);
  }
  return mode.get();
}

/** Request the native DevTools toggle after synchronously checking host policy. */
export function requestDevtoolsToggle():
  | { status: "committed" }
  | { status: "unavailable"; reason: "developer_mode_disabled" | "desktop_unavailable" } {
  if (!developerMode.get()) {
    return { status: "unavailable", reason: "developer_mode_disabled" };
  }
  if (!isDesktop()) {
    return { status: "unavailable", reason: "desktop_unavailable" };
  }
  void invoke("developer_toggle_devtools");
  return { status: "committed" };
}
