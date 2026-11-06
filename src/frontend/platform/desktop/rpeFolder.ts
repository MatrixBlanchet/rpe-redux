/**
 * Desktop adapter for choosing and scanning a native RPE installation.
 *
 * The picker returns a path; the native scan command reads only the RPE
 * sidecars and the direct chart folders under Resources. Chart bytes still flow
 * through the existing document store when the migration imports them.
 */
import { invoke } from "@tauri-apps/api/core";
import { isDesktop } from "../../../core/platform/environment.ts";
import { t } from "../../../i18n/index.ts";
import type { RpeFolderScan } from "../../../core/migration/rpe.ts";

/** Ask the user for an RPE root, or null when the dialog is cancelled. */
export async function chooseRpeFolder(): Promise<string | null> {
  if (!isDesktop()) {
    return null;
  }
  const { open } = await import("@tauri-apps/plugin-dialog");
  const selected = await open({
    directory: true,
    multiple: false,
    title: t("workspace.welcome.rpe.pickFolder"),
  });
  return typeof selected === "string" ? selected : null;
}

/** Scan one RPE root through the native bounded folder reader. */
export function scanRpeFolder(path: string): Promise<RpeFolderScan> {
  return invoke<RpeFolderScan>("scan_rpe_root", { path });
}
