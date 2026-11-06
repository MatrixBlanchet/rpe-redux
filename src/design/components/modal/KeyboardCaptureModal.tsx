/**
 * A modal surface for capturing one keyboard chord.
 *
 * Ordinary modals focus their first action and let Escape cancel. A recording
 * surface must do neither: the capture body owns initial focus, and Escape is a
 * key the user may want to bind. The shared `Modal` still owns the dialog,
 * scrim, focus containment, and stacking.
 */
import { useEffect, useRef, type HTMLAttributes, type ReactNode } from "react";
import { Modal } from "./Modal.tsx";

export interface KeyboardCaptureModalProps {
  open: boolean;
  title: string;
  children: ReactNode;
  actions: ReactNode;
  /** Extra class on the footer action row. */
  actionsClassName?: string;
  /** Extra attributes on the footer action row, for stable data hooks. */
  actionsProps?: Omit<HTMLAttributes<HTMLDivElement>, "className" | "children"> &
    Partial<Record<`data-${string}`, string>>;
  onCancel(): void;
}

/** Renders a modal whose body owns focus and whose Escape key is capturable. */
export function KeyboardCaptureModal({
  open,
  title,
  children,
  actions,
  actionsClassName,
  actionsProps,
  onCancel,
}: KeyboardCaptureModalProps) {
  const focusRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      focusRef.current?.focus({ preventScroll: true });
    }
  }, [open]);

  return (
    <Modal
      open={open}
      onClose={onCancel}
      onCancel={(event) => event.preventDefault()}
      closeButton={false}
      label={title}
      className="redux-keyboard-capture"
      actions={actions}
      actionsClassName={actionsClassName}
      actionsProps={actionsProps}
    >
      <div ref={focusRef} className="redux-keyboard-capture-body" tabIndex={-1}>
        {children}
      </div>
    </Modal>
  );
}
