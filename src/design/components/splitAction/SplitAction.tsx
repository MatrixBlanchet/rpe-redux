/**
 * Split-action primitive: a primary action joined to a menu trigger that shares one
 * border, radius, and background. Only the trigger geometry lives here; the popup
 * and chosen action belong to the caller.
 */
import { forwardRef, type ReactNode, type Ref } from "react";
import { Icon } from "../icon/Icon.tsx";

/** Props for the split action: one label, two handlers, and optional per-half overrides. */
export interface SplitActionProps {
  label: ReactNode;
  ariaLabel: string;
  actionId?: string;
  toggleId?: string;
  popupId?: string;
  open?: boolean;
  /** Disables both halves unless a specific half overrides it. */
  disabled?: boolean;
  /** The action half only; useful when the menu must stay reachable. */
  actionDisabled?: boolean;
  /** The menu half only. */
  toggleDisabled?: boolean;
  className?: string;
  actionData?: Record<string, string | undefined>;
  actionRef?: Ref<HTMLButtonElement>;
  toggleRef?: Ref<HTMLButtonElement>;
  onAction(): void;
  onToggle(): void;
}

/** A primary action joined to a menu trigger that shares one border, radius, and background. */
export const SplitAction = forwardRef<HTMLDivElement, SplitActionProps>(function SplitAction(
  {
    label,
    ariaLabel,
    actionId,
    toggleId,
    popupId,
    open = false,
    disabled = false,
    actionDisabled,
    toggleDisabled,
    className = "",
    actionData,
    actionRef,
    toggleRef,
    onAction,
    onToggle,
  },
  ref,
) {
  return (
    <div ref={ref} className={`redux-split-action ${className}`}>
      <button
        ref={actionRef}
        id={actionId}
        type="button"
        className="redux-split-action-main"
        disabled={actionDisabled ?? disabled}
        onClick={onAction}
        {...actionData}
      >
        {label}
      </button>
      <button
        ref={toggleRef}
        id={toggleId}
        type="button"
        className="redux-split-action-toggle"
        aria-label={ariaLabel}
        data-tip-title={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={popupId}
        disabled={toggleDisabled ?? disabled}
        onClick={onToggle}
      >
        <Icon name="chevronDown" size={14} />
      </button>
    </div>
  );
});
