/**
 * Two-or-more mutually exclusive choices, laid out as a labelled row.
 *
 * The inspector uses it where a radio group would be correct but a stack of
 * radios costs a row per option: the label sits on the left like every other
 * field, and the choices sit on the right as one connected control. It owns no
 * product state; callers pass the current value and receive the next one.
 */
import type { ReactNode } from "react";

export interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
  /** Tooltip and accessible name for icon-only choices. */
  title?: string;
  ariaLabel?: string;
  disabled?: boolean;
}

export interface SegmentedProps<T extends string> {
  /** Visible row label. Omitted when the choices name what they switch. */
  label?: ReactNode;
  /** Names the group for assistive technology when there is no visible label. */
  ariaLabel?: string;
  value: T;
  options: readonly SegmentedOption<T>[];
  onChange(value: T): void;
  disabled?: boolean;
  className?: string;
}

/** A labelled radio group laid out as one connected control. */
export function Segmented<T extends string>({
  label,
  ariaLabel,
  value,
  options,
  onChange,
  disabled = false,
  className = "",
}: SegmentedProps<T>) {
  return (
    <div className={`redux-segmented ${className}`}>
      {label !== undefined && <span className="redux-segmented-label">{label}</span>}
      <div className="redux-segmented-options" role="radiogroup" aria-label={ariaLabel}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              className={`redux-segmented-option${selected ? " is-selected" : ""}`}
              disabled={disabled || option.disabled}
              aria-label={option.ariaLabel ?? option.title}
              data-tip-title={option.title}
              onClick={() => {
                if (!selected) {
                  onChange(option.value);
                }
              }}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
