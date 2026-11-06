/**
 * The shell's single modal host.
 *
 * It renders the highest-priority queue entry and appends that entry's panel, so a
 * feature contributes content without creating a modal of its own.
 */
import { useLayoutEffect, useRef, useSyncExternalStore } from "react";
import { Modal } from "../../../design/components/modal/Modal.tsx";
import { activeModal, dismissModal, finishModal, subscribeModals } from "./modalQueue.ts";

/** The application's only queued modal host and priority presentation point. */
export function ModalHost() {
  const entry = useSyncExternalStore(subscribeModals, activeModal, activeModal);
  const content = useRef<HTMLDivElement>(null);
  const panel = entry?.panel;
  const hasContent = Boolean(panel || entry?.options.children);
  /** Moves the entry's panel into the host and focuses its first control when the dialog opens. */
  useLayoutEffect(() => {
    const target = content.current;
    if (!target || !panel) {
      return;
    }
    target.append(panel);
    if (target.closest("dialog")?.open) {
      panel
        .querySelector<HTMLElement>("[autofocus], input, button, select, textarea, [tabindex]")
        ?.focus();
    }
    return () => panel.remove();
  }, [panel]);
  return (
    <Modal
      {...entry?.options}
      open={Boolean(entry && !entry.closing)}
      instanceKey={entry?.id}
      priority={entry?.priority}
      onClose={() => {
        if (entry && !entry.closing) {
          entry.options.onClose();
          dismissModal(entry.id);
        }
      }}
      onClosed={() => {
        if (!entry) {
          return;
        }
        if (!entry.closing) {
          entry.options.onClose();
        }
        finishModal(entry.id);
      }}
    >
      {hasContent ? (
        <div ref={content} style={{ display: "contents" }}>
          {panel ? null : entry?.options.children}
        </div>
      ) : null}
    </Modal>
  );
}
