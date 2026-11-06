/**
 * Contributes one request's content to the shared modal host.
 *
 * The panel is a stable portal target, so fields and canvases survive a wait in the
 * queue; this module never creates a modal element itself.
 */
import { useId, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { dismissModal, presentModal, type ModalOptions } from "./modalQueue.ts";

/** Contribute content to the single host; this module never creates a modal element. */
export function ModalRequest({
  open,
  requestId,
  ...options
}: ModalOptions & { open: boolean; requestId?: string }) {
  const localId = useId();
  const id = requestId ?? localId;
  // A stable portal target preserves field refs and image canvases while waiting in the queue.
  const [panel] = useState(() => {
    const target = document.createElement("div");
    target.style.display = "contents";
    return target;
  });
  useLayoutEffect(() => {
    if (open) {
      presentModal(id, options, panel);
    } else {
      dismissModal(id);
    }
  }, [id, open, options, panel]);
  useLayoutEffect(() => () => dismissModal(id), [id]);
  return createPortal(options.children, panel);
}
