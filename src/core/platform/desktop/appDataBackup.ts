/**
 * Desktop backup and restore of Redux-owned application data.
 *
 * The caller chooses the parts to carry; the database is exported and imported as
 * a staged file that applies on the next start, while themes travel as archive
 * entries. Crash recovery lives inside the database and is not a separate part.
 */
import { invoke } from "@tauri-apps/api/core";
import { t } from "../../../i18n/index.ts";
import { preferences } from "../../state/preferences.ts";
import { localService } from "../../global/library/service.ts";
import { dialogDefaultPath, rememberDialogFile } from "./dialogPath.ts";

/**
 * What a bundle may carry.
 *
 * A part is the unit the user chooses: a portable build replaced by a newer one
 * usually wants `database` (settings, shortcuts, the chart library) and `themes`.
 */
export const APP_DATA_PARTS = ["database", "themes", "skins", "extensions"] as const;

/** One selectable unit of application data. */
export type AppDataPart = (typeof APP_DATA_PARTS)[number];

/** Parts selected when the caller does not narrow the set. */
export const DEFAULT_APP_DATA_PARTS: readonly AppDataPart[] = APP_DATA_PARTS;

/** Result of restoring a bundle. */
export interface ImportOutcome {
  parts: string[];
  /** The database or themes are applied the next time the app starts. */
  restartRequired: boolean;
}

/** Export durable Redux-owned data, leaving WebView cache and runtime files out. */
export async function exportAppDataBackup(
  parts: readonly AppDataPart[] = DEFAULT_APP_DATA_PARTS,
): Promise<string | null> {
  const path = await (
    await import("@tauri-apps/plugin-dialog")
  ).save({
    defaultPath: dialogDefaultPath("backup", "RPE-Redux-backup.zip"),
    filters: [{ name: t("system.backup.fileType"), extensions: ["zip"] }],
  });
  if (!path) {
    return null;
  }
  rememberDialogFile("backup", path);

  await preferences.flush();
  const service = await localService();
  await service?.library.checkpoint();
  return invoke<string>("export_app_backup", { path, parts });
}

/** Restore the chosen parts of a bundle; the database and themes apply on the next start. */
export async function importAppDataBackup(
  parts: readonly AppDataPart[] = DEFAULT_APP_DATA_PARTS,
): Promise<ImportOutcome | null> {
  const path = await (
    await import("@tauri-apps/plugin-dialog")
  ).open({
    multiple: false,
    directory: false,
    defaultPath: dialogDefaultPath("backup"),
    filters: [{ name: t("system.backup.fileType"), extensions: ["zip"] }],
  });
  if (!path || typeof path !== "string") {
    return null;
  }
  rememberDialogFile("backup", path);
  return invoke<ImportOutcome>("import_app_backup", { path, parts });
}
