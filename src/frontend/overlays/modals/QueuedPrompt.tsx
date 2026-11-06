/**
 * The state machine shared by the shell's queued prompts.
 *
 * A prompt ascends through `ModalRequest`; the request it renders outlives its
 * own answer by the exit animation, so the dialog keeps the last question until
 * it has finished closing. `useQueuedPrompt` owns that retention, and
 * `usePromptAction` owns the submit/error cycle every dialog repeats.
 */
import { useState, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import { InputActions } from "./PromptContent.tsx";
import { InlineAlert } from "../../../design/components/alert/InlineAlert.tsx";
import { ModalRequest } from "./ModalRequest.ts";

/** Last request and open flag for one queued prompt store. */
export interface QueuedPromptState<T> {
  /** The last request, retained while the dialog animates out. */
  request: T | null;
  /** Whether a request is still pending rather than closing. */
  open: boolean;
}

/**
 * Follows one queued prompt store and retains its last request through close.
 *
 * Callers still decide which body belongs to a request; this hook only owns the
 * shared last-request/open pair.
 */
export function useQueuedPrompt<T>(
  subscribe: (listener: () => void) => () => void,
  getSnapshot: () => T | null,
): QueuedPromptState<T> {
  const pending = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const [last, setLast] = useState<T | null>(pending);
  if (pending && pending !== last) {
    setLast(pending);
  }
  return { request: pending ?? last, open: Boolean(pending) };
}

/** What a rejected submit shows: the caller's own check or failure message. */
export function promptFailureMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}

/** Submit state and callbacks exposed to a prompt body. */
export interface PromptActionState {
  error: string;
  pending: boolean;
  run(work: () => void | Promise<void>): void;
  clearError(): void;
}

/**
 * Runs one prompt's submit work.
 *
 * The dialog stays up on failure and shows the thrown message; success closes
 * the prompt unless the request owns its own closing rule.
 */
export function usePromptAction(
  close: () => void,
  options: { closeOnSuccess?: boolean } = {},
): PromptActionState {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  /** Runs the submit work once, clearing prior errors and recording a rejection. */
  const run = (work: () => void | Promise<void>) => {
    if (pending) {
      return;
    }
    setError("");
    setPending(true);
    void (async () => {
      try {
        await work();
        if (options.closeOnSuccess !== false) {
          close();
        }
      } catch (reason) {
        setError(promptFailureMessage(reason));
      } finally {
        setPending(false);
      }
    })();
  };
  return {
    error,
    pending,
    run,
    clearError: () => setError(""),
  };
}

/** Props for the shared prompt shell. */
export interface PromptDialogProps {
  requestId: string;
  open: boolean;
  onClose(): void;
  label: string;
  description?: string;
  className?: string;
  /** Body content; the shared error line is appended below it. */
  children: ReactNode;
  error: string;
  pending?: boolean;
  submitLabel: string;
  submitVariant?: "solid" | "danger";
  cancelLabel?: string;
  submitDisabled?: boolean;
  onSubmit(): void;
}

/**
 * The shared prompt shell: content, error line, and a cancel/submit footer.
 *
 * The footer is the same pair in every queued prompt, so a dialog only supplies
 * its fields and the action its submit performs.
 */
export function PromptDialog({
  requestId,
  open,
  onClose,
  label,
  description,
  className,
  children,
  error,
  pending = false,
  submitLabel,
  submitVariant = "solid",
  cancelLabel,
  submitDisabled = false,
  onSubmit,
}: PromptDialogProps) {
  return (
    <ModalRequest
      requestId={requestId}
      open={open}
      onClose={onClose}
      label={label}
      description={description}
      className={className}
      actions={
        <InputActions
          confirmLabel={submitLabel}
          cancelLabel={cancelLabel}
          submitVariant={submitVariant}
          cancelDisabled={pending}
          submitDisabled={pending || submitDisabled}
          cancel={onClose}
          submit={onSubmit}
        />
      }
    >
      {children}
      {error && <InlineAlert className="modal-error">{error}</InlineAlert>}
    </ModalRequest>
  );
}
