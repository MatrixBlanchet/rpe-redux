/**
 * The remembered clipboard: the current snapshot plus the pinned and recent
 * entries the clipboard panel lists.
 *
 * Each entry records the line it came from so a paste can restore the original
 * placement, and a `change` event tells persistence when the list is worth
 * writing.
 */
import { t } from "../../../i18n/index.ts";
import { beatValue } from "../../global/chart/timing/beat.ts";
import type { JudgeLineNote } from "../../global/chart/chart.ts";
import type { ClippedEvent, EditorSession } from "../session/session.ts";

/** The clipboard contents as they are snapshotted and persisted. */
export interface ClipboardSnapshot {
  notes: JudgeLineNote[];
  noteLines: number[];
  events: ClippedEvent[];
  eventLines: number[];
  /** Source layer for each event; absent on entries saved before layers. */
  eventLayers?: number[];
  /** Paste events back onto their source layers rather than the active layer. */
  preserveLayers?: boolean;
}

/** One remembered clipboard snapshot. */
export interface ClipboardHistoryEntry extends ClipboardSnapshot {
  id: string;
  pinned: boolean;
  name: string;
  source: string;
  line: number;
  created: number;
}

/** The `change` event `ClipboardHistory` dispatches, with its payload fields. */
export interface ClipboardHistoryChangeEvent extends Event {
  persist: boolean;
  reason: string;
}

/** Stores the current clipboard snapshot plus pinned and recent history entries. */
export class ClipboardHistory extends EventTarget {
  limit: number;
  entries: ClipboardHistoryEntry[];
  revision: number;
  current: ClipboardSnapshot;
  activeId: string | null;

  /** Creates an empty history bounded to `limit` entries. */
  constructor(limit = 20) {
    super();
    this.limit = limit;
    this.entries = [];
    this.revision = 0;
    this.current = {
      notes: [],
      noteLines: [],
      events: [],
      eventLines: [],
      eventLayers: [],
      preserveLayers: false,
    };
    this.activeId = null;
  }

  /** Dispatches a `change` event carrying whether it should be persisted. */
  changed(persist = true, reason = ""): void {
    this.revision++;
    const event = new Event("change") as ClipboardHistoryChangeEvent;
    event.persist = persist;
    event.reason = reason;
    this.dispatchEvent(event);
  }

  /** Loads persisted entries when the in-memory history is still untouched. */
  restore(entries: unknown): void {
    if (this.revision || !Array.isArray(entries)) {
      return;
    }
    const ids = new Set<string>();
    this.entries = entries
      .filter((entry) => {
        if (
          !entry ||
          typeof entry.id !== "string" ||
          ids.has(entry.id) ||
          !Array.isArray(entry.notes) ||
          !Array.isArray(entry.events) ||
          !(entry.notes.length + entry.events.length)
        ) {
          return false;
        }
        try {
          for (const item of [
            ...entry.notes,
            ...entry.events.map((item: { event: unknown }) => item.event),
          ]) {
            beatValue(item.startTime);
            beatValue(item.endTime);
          }
        } catch {
          return false;
        }
        ids.add(entry.id);
        return true;
      })
      .slice(0, this.limit)
      .map((entry) => ({ ...structuredClone(entry), pinned: Boolean(entry.pinned) }));
    this.dispatchEvent(new Event("change"));
  }

  /** Captures the session clipboard and promotes or adds its history entry. */
  remember(session: EditorSession): void {
    this.current = structuredClone({
      notes: session.clipboard,
      noteLines: session.clipboardNoteLines ?? [],
      events: session.eventClipboard,
      eventLines: session.eventClipboardLines ?? [],
      eventLayers: session.eventClipboardLayers ?? [],
      preserveLayers: session.eventClipboardPreserveLayers === true,
    });
    this.activeId = null;
    if (this.current.notes.length + this.current.events.length) {
      const signature = JSON.stringify(this.current);
      const previous = this.entries.find(
        (entry) =>
          JSON.stringify({
            notes: entry.notes,
            noteLines: entry.noteLines ?? [],
            events: entry.events,
            eventLines: entry.eventLines ?? [],
            eventLayers: entry.eventLayers ?? [],
            preserveLayers: entry.preserveLayers === true,
          }) === signature,
      );
      if (previous) {
        this.entries = this.entries.filter((entry) => entry !== previous);
      }
      const entry: ClipboardHistoryEntry = {
        ...structuredClone(this.current),
        id: previous?.id ?? crypto.randomUUID(),
        pinned: previous?.pinned ?? false,
        name: previous?.name ?? "",
        source: session.chart.META.name || t("editor.commands.clipboardHistory.untitledChart"),
        line: session.lineIndex,
        created: Date.now(),
      };
      if (this.entries.length >= this.limit) {
        const oldest = this.entries.findLastIndex((entry) => !entry.pinned);
        if (oldest >= 0) {
          this.entries.splice(oldest, 1);
        }
      }
      if (this.entries.length < this.limit) {
        this.entries.unshift(entry);
        this.activeId = entry.id;
      }
    }
    this.changed(this.activeId !== null);
  }

  /** Replaces the session clipboard with the current snapshot. */
  attach(session: EditorSession): void {
    session.clipboard = structuredClone(this.current.notes);
    session.clipboardNoteLines = structuredClone(
      this.current.noteLines ?? session.clipboard.map(() => session.lineIndex),
    );
    session.eventClipboard = structuredClone(this.current.events);
    session.eventClipboardLines = structuredClone(
      this.current.eventLines ?? session.eventClipboard.map(() => session.lineIndex),
    );
    session.eventClipboardLayers = structuredClone(
      this.current.eventLayers ?? session.eventClipboard.map(() => session.eventLayer),
    );
    session.eventClipboardPreserveLayers = this.current.preserveLayers === true;
  }

  /** Activates a stored entry and copies it into the session; false if unknown. */
  use(session: EditorSession, id: string): boolean {
    const entry = this.entries.find((entry) => entry.id === id);
    if (!entry) {
      return false;
    }
    this.current = structuredClone({
      notes: entry.notes,
      noteLines: entry.noteLines ?? [],
      events: entry.events,
      eventLines: entry.eventLines ?? [],
      eventLayers: entry.eventLayers ?? [],
      preserveLayers: entry.preserveLayers === true,
    });
    this.activeId = id;
    this.attach(session);
    this.changed(false);
    return true;
  }

  /** Empties the current clipboard without removing history entries. */
  clearCurrent(session: EditorSession): void {
    this.current = {
      notes: [],
      noteLines: [],
      events: [],
      eventLines: [],
      eventLayers: [],
      preserveLayers: false,
    };
    this.activeId = null;
    this.attach(session);
    this.changed(false);
  }
  /** Toggles an entry's pinned flag; pinned entries survive pruning. */
  pin(id: string): void {
    const entry = this.entries.find((entry) => entry.id === id);
    if (entry) {
      entry.pinned = !entry.pinned;
      this.changed();
    }
  }
  /** Sets a trimmed, length-limited display name for one entry. */
  rename(id: string, name: unknown): void {
    const entry = this.entries.find((entry) => entry.id === id);
    if (entry) {
      entry.name = String(name).trim().slice(0, 40);
      this.changed(true, "rename");
    }
  }
  /** Removes one entry and clears the active id when it pointed at that entry. */
  remove(id: string): void {
    this.entries = this.entries.filter((entry) => entry.id !== id);
    if (this.activeId === id) {
      this.activeId = null;
    }
    this.changed();
  }
  /** Drops every unpinned entry and clears the active id when it was dropped. */
  clearUnpinned(): void {
    this.entries = this.entries.filter((entry) => entry.pinned);
    if (!this.entries.some((entry) => entry.id === this.activeId)) {
      this.activeId = null;
    }
    this.changed();
  }
}
