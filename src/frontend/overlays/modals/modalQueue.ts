/**
 * The ordered queue behind every modal in the application.
 *
 * Entries are presented one at a time by priority and then arrival, and each keeps
 * its panel alive while it waits.
 */
import { createValue } from "../../../core/state/values.ts";
import type { ComponentProps } from "react";
import type { Modal } from "../../../design/components/modal/Modal.tsx";

/** Higher values are presented above lower-priority surfaces. */
export type ModalPriority = number;

export const MODAL_PRIORITY = Object.freeze({
  normal: 0,
  closePrompt: 100,
  /** A trust-boundary confirmation that must appear above a settings page. */
  consent: 120,
} satisfies Record<string, ModalPriority>);

/** Props accepted by a queued modal entry. */
export type ModalOptions = Omit<ComponentProps<typeof Modal>, "open" | "onClosed" | "instanceKey">;

/** One queued modal: its options, optional portal panel, and presentation order. */
export interface ModalQueueEntry {
  id: string;
  options: ModalOptions;
  panel?: HTMLElement;
  closing: boolean;
  priority: ModalPriority;
  sequence: number;
}

const queue = createValue<readonly ModalQueueEntry[]>({ initial: [] });
let nextSequence = 0;
export const subscribeModals = queue.subscribe;

/** Returns the entry currently presented at the front of the queue. */
export const activeModal = (): ModalQueueEntry | null => queue.get()[0] ?? null;

/** Sorts entries by descending priority, then by arrival. */
function orderEntries(entries: readonly ModalQueueEntry[]): readonly ModalQueueEntry[] {
  return [...entries].sort((a, b) => b.priority - a.priority || a.sequence - b.sequence);
}

/** Adds an entry, or replaces one with the same id while keeping its priority and queue position. */
export function presentModal(id: string, options: ModalOptions, panel?: HTMLElement): void {
  const entries = queue.get();
  const index = entries.findIndex((entry) => entry.id === id);
  const old = index < 0 ? undefined : entries[index];
  const entry: ModalQueueEntry = {
    id,
    options,
    panel,
    closing: false,
    priority: options.priority ?? MODAL_PRIORITY.normal,
    sequence: old?.sequence ?? nextSequence++,
  };
  queue.set(
    orderEntries(
      index < 0 ? [...entries, entry] : entries.map((item, at) => (at === index ? entry : item)),
    ),
  );
}

/** Starts closing an entry; a waiting entry is removed from the queue outright. */
export function dismissModal(id: string): void {
  const entries = queue.get();
  const index = entries.findIndex((entry) => entry.id === id);
  if (index < 0) {
    return;
  }
  if (index === 0) {
    if (!entries[0].closing) {
      queue.set([{ ...entries[0], closing: true }, ...entries.slice(1)]);
    }
  } else {
    queue.set([...entries.slice(0, index), ...entries.slice(index + 1)]);
  }
}

/** Close the visible modal and discard every queued modal behind it. */
export function dismissAllModals(): void {
  const entries = queue.get();
  if (!entries.length) {
    return;
  }
  queue.set([{ ...entries[0], closing: true }]);
}

/** Drops the front entry after its exit animation, letting the next one present. */
export function finishModal(id: string): void {
  if (queue.get()[0]?.id === id) {
    queue.set(queue.get().slice(1));
  }
}
