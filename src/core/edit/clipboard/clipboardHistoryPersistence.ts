/**
 * Persists clipboard history through the preference store.
 *
 * Writes are serialized so a burst of copy operations cannot reorder the
 * stored list; restore and write failures are reported to the caller.
 */
import { PREFERENCE_SECTIONS, readPreference, writePreference } from "../../state/preferences.ts";
import { t } from "../../../i18n/index.ts";
import type { ClipboardHistory, ClipboardHistoryChangeEvent } from "./clipboardHistory.ts";

/** Restores saved entries and writes later changes in order; returns the unsubscribe. */
export function bindClipboardHistoryPersistence(
  history: ClipboardHistory,
  report: (message: string) => void,
): () => void {
  let pending: Promise<unknown> = Promise.resolve();
  /** Reads a display message from an unknown failure. */
  const failure = (error: unknown) => (error instanceof Error ? error.message : String(error));
  /** Queues a serialized write for persistable history changes. */
  const changed = (event: Event) => {
    if (!(event as ClipboardHistoryChangeEvent).persist) {
      return;
    }
    const entries = structuredClone(history.entries);
    pending = pending
      .then(() => writePreference(PREFERENCE_SECTIONS.clipboard, entries))
      .catch((error) =>
        report(t("editor.app.notice.clipboardHistorySaveFailed", { message: failure(error) })),
      );
  };
  history.addEventListener("change", changed);
  try {
    history.restore(readPreference(PREFERENCE_SECTIONS.clipboard, []) ?? []);
  } catch (error) {
    report(t("editor.app.notice.clipboardHistoryLoadFailed", { message: failure(error) }));
  }
  return () => history.removeEventListener("change", changed);
}
