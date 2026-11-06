/**
 * The last RPE migration's hotkey report, kept for the shortcut page.
 *
 * The migration applies only the hotkeys that have a matching command. The rest
 * are not an error, but they are the exact list a user needs to see when a key
 * they have used for years does nothing here, so the report is persisted instead
 * of living only in the completion notice.
 */
import {
  PREFERENCE_SECTIONS,
  readPreference,
  writePreference,
} from "../../../../core/state/preferences.ts";
import type { RpeHotkeyEntry } from "../../../../core/migration/rpe.ts";
import { isRecord } from "../../../../core/utils/guards.ts";

/** One stored migration: when it ran and every hotkey line it read. */
export interface RpeHotkeyRecord {
  /** Epoch milliseconds of the migration that produced the record. */
  at: number;
  entries: readonly RpeHotkeyEntry[];
}

/** A tampered preference file cannot turn the shortcut page into a huge list. */
const MAX_STORED_HOTKEYS = 2000;

/** Reads the last migration's hotkey report, or null when none was recorded. */
export function readRpeHotkeyRecord(): RpeHotkeyRecord | null {
  const value = readPreference<unknown>(PREFERENCE_SECTIONS.rpe, null);
  if (!isRecord(value) || !Array.isArray(value.hotkeys)) {
    return null;
  }
  const entries: RpeHotkeyEntry[] = [];
  for (const raw of value.hotkeys) {
    if (entries.length >= MAX_STORED_HOTKEYS) {
      break;
    }
    if (!isRecord(raw) || typeof raw.action !== "string" || typeof raw.binding !== "string") {
      continue;
    }
    entries.push({
      action: raw.action,
      binding: raw.binding,
      ...(typeof raw.target === "string" ? { target: raw.target } : {}),
      ...(raw.reason === "unknown-action" || raw.reason === "invalid-binding"
        ? { reason: raw.reason }
        : {}),
    });
  }
  return {
    at: typeof value.at === "number" ? value.at : 0,
    entries,
  };
}

/** Stores the hotkey report from one migration. */
export function writeRpeHotkeyRecord(entries: readonly RpeHotkeyEntry[]): void {
  writePreference(PREFERENCE_SECTIONS.rpe, { at: Date.now(), hotkeys: [...entries] });
}

/** Forgets the stored report; the shortcut page offers this after it is read. */
export function clearRpeHotkeyRecord(): void {
  writePreference(PREFERENCE_SECTIONS.rpe, null);
}
