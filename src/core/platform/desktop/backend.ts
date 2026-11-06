/**
 * The Tauri command that starts the bundled Go service.
 *
 * Resolves only after the host-side health check passes.
 */
import { invoke } from "@tauri-apps/api/core";
import { setLibraryInstanceId } from "../../global/library/instances.ts";

/** Resolves only when the desktop-owned backend has passed its health check. */
export function startBackend(): Promise<void> {
  return invoke("start_backend");
}

/** Adopt the host-generated instance id used by backend occupancy. */
export async function prepareBackendInstance(): Promise<void> {
  const id = await invoke<string>("backend_instance_id").catch(() => null);
  if (id) {
    setLibraryInstanceId(id);
  }
}
