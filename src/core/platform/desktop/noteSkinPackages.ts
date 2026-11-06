/**
 * Note-skin folders discovered beside the executable.
 *
 * Discovery is a host concern: the desktop scanner returns folder summaries and
 * relative file bytes, while `core/media/noteSkin.ts` remains the only parser
 * and validator. The cache is updated by the shell's folder poll so the skin
 * picker reacts without a manual refresh.
 */
import { invoke } from "@tauri-apps/api/core";
import { isDesktop } from "../environment.ts";
import {
  activeNoteSkin,
  EXTERNAL_NOTE_SKIN_PREFIX,
  notifyNoteSkinChanged,
} from "../../media/noteSkins.ts";
import { isPackageName, type PackageName } from "../../utils/packageName.ts";

/** A note-skin folder found on disk, as the picker lists it. */
export interface ExternalNoteSkinSummary {
  readonly id: string;
  readonly name: PackageName;
  readonly source: string;
  /** Host-computed content signature; changes when files on disk change. */
  readonly fingerprint: string;
}

let cached: readonly ExternalNoteSkinSummary[] = Object.freeze([]);
const listeners = new Set<() => void>();

/** Notify every listener after the cached folder set changes. */
function notify(): void {
  for (const listener of [...listeners]) {
    listener();
  }
}

/** Subscribe to external note-skin folder changes. */
export function subscribeExternalNoteSkins(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The external note-skin folders found by the last scan. */
export function externalNoteSkins(): readonly ExternalNoteSkinSummary[] {
  return cached;
}

/** Re-scan the host skin roots; notify only when the folder set changed. */
export async function refreshExternalNoteSkins(): Promise<void> {
  if (!isDesktop()) {
    return;
  }
  let next: ExternalNoteSkinSummary[];
  try {
    next = await invoke<ExternalNoteSkinSummary[]>("list_note_skins");
  } catch {
    return;
  }
  const previous = new Map(cached.map((entry) => [entry.id, entry.fingerprint]));
  const before = JSON.stringify(cached);
  cached = Object.freeze(
    // The staged `skins/default` copy is the built-in package; the picker
    // already offers it through `builtin:default`, so do not list it twice.
    next
      .filter((entry) => String(entry.id ?? "") !== "default")
      .map((entry) => ({
        id: String(entry.id ?? ""),
        name: isPackageName(entry.name) ? entry.name : String(entry.name ?? entry.id ?? ""),
        source: String(entry.source ?? "portable"),
        fingerprint: String(entry.fingerprint ?? ""),
      })),
  );
  if (JSON.stringify(cached) === before) {
    return;
  }
  notify();
  const active = activeNoteSkin();
  if (!active.startsWith(EXTERNAL_NOTE_SKIN_PREFIX)) {
    return;
  }
  const id = active.slice(EXTERNAL_NOTE_SKIN_PREFIX.length);
  const fingerprint = cached.find((entry) => entry.id === id)?.fingerprint;
  // The picker may only need a redraw, but the preview has to decode the new
  // bytes when the active package itself changed.
  if (previous.get(id) !== fingerprint) {
    notifyNoteSkinChanged();
  }
}

/** Read one skin package and decode its base64 file map for the shared parser. */
export async function readExternalNoteSkin(id: string): Promise<Map<string, Uint8Array>> {
  const payload = await invoke<{
    files?: { name?: string; data?: string }[];
  }>("read_note_skin", { id });
  const files = new Map<string, Uint8Array>();
  for (const entry of payload.files ?? []) {
    if (!entry.name || typeof entry.data !== "string") {
      continue;
    }
    const binary = atob(entry.data);
    files.set(
      entry.name,
      Uint8Array.from(binary, (character) => character.charCodeAt(0)),
    );
  }
  return files;
}
