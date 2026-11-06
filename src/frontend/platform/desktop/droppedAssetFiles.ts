/**
 * Reads OS-dropped files for the asset library.
 *
 * The native window owns drag-and-drop; the webview receives paths rather than
 * File objects, so this adapter turns those paths into bytes and bare names.
 */
import { invoke } from "@tauri-apps/api/core";
import { isDesktop } from "../../../core/platform/environment.ts";

/** One OS-dropped file with its bare name and bytes. */
export interface DroppedAssetFile {
  readonly name: string;
  readonly bytes: Uint8Array;
}

/** Payload shape returned by the desktop file reader. */
interface DroppedAssetPayload {
  readonly name: string;
  readonly bytes: number[];
}

/** Reads dropped paths as files; returns an empty list outside the desktop host. */
export async function readDroppedAssetFiles(
  paths: readonly string[],
): Promise<readonly DroppedAssetFile[]> {
  if (!isDesktop() || paths.length === 0) {
    return [];
  }
  const files = await invoke<DroppedAssetPayload[]>("read_dropped_asset_files", {
    paths: [...paths],
  });
  return files.map((file) => ({
    name: file.name,
    bytes: new Uint8Array(file.bytes),
  }));
}
