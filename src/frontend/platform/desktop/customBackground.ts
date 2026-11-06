/**
 * Desktop storage for user-chosen background images.
 *
 * Bytes are written outside chart and library storage and read back by the
 * reference the settings value keeps.
 */
import { invoke } from "@tauri-apps/api/core";

/** Persist a validated image outside chart and library storage. */
export async function saveCustomBackground(name: string, bytes: Uint8Array): Promise<string> {
  return invoke<string>("save_custom_background", {
    name,
    bytes: Array.from(bytes),
  });
}

/** Read a previously stored custom background by its relative app-data reference. */
export async function readCustomBackground(reference: string): Promise<Uint8Array> {
  const response = await invoke<number[] | ArrayBuffer>("read_custom_background", { reference });
  return response instanceof ArrayBuffer ? new Uint8Array(response) : Uint8Array.from(response);
}
