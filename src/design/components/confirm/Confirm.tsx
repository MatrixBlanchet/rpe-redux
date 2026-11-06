/**
 * A focused confirmation surface built on the one modal primitive.
 *
 * Confirmations are a product decision, but their chrome is shared: no close
 * button, an explicit cancel/confirm pair, Escape as cancel, and the danger
 * action only when the caller says the operation discards work.
 */
import type { ReactNode } from "react";
import { Button } from "../button/Button.tsx";
import { Modal } from "../modal/Modal.tsx";
import { useTranslation } from "../../../i18n/react.ts";

export interface ConfirmProps {
  open: boolean;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** A destructive answer uses the danger surface. */
  destructive?: boolean;
  onConfirm(): void;
  onCancel(): void;
  onClosed?(): void;
  priority?: number;
  className?: string;
}

/**
 * The design-system confirmation dialog.
 *
 * The caller owns the answer; this component only renders the two choices and
 * closes through the shared modal stack. Escape and scrim dismissal both mean
 * cancel, matching the explicit cancel button.
 */
export function Confirm({
  open,
  title,
  description,
  children,
  confirmLabel,
  cancelLabel,
  destructive = false,
  onConfirm,
  onCancel,
  onClosed,
  priority,
  className,
}: ConfirmProps) {
  const { t } = useTranslation();
  return (
    <Modal
      open={open}
      onClose={() => undefined}
      onClosed={onClosed}
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      priority={priority}
      label={title}
      description={description}
      closeButton={false}
      role="alertdialog"
      className={`redux-confirm ${className ?? ""}`}
      actions={
        <>
          <Button variant="outlined" onClick={onCancel}>
            {cancelLabel ?? t("common.action.cancel")}
          </Button>
          <Button variant={destructive ? "danger" : "solid"} onClick={onConfirm}>
            {confirmLabel ?? t("common.action.confirm")}
          </Button>
        </>
      }
    >
      {children}
    </Modal>
  );
}
