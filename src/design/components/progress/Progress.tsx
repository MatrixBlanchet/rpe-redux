/**
 * A tokenised progress bar for long-running work.
 *
 * The design system draws progress with its own track and fill so a download,
 * chart build, or update keeps the same height, radius, motion, and colour in
 * every theme. A missing value means the work is still indeterminate.
 */

import { progressRatio } from "./progressValue.ts";

export interface ProgressProps {
  /** Completed amount; omit to draw the indeterminate bar. */
  value?: number;
  /** Upper bound for `value`; defaults to 1. */
  max?: number;
  /** Accessible name for the progressbar. */
  label: string;
  /** Optional visible readout, for example `42%`. */
  valueText?: string;
  /** Compact bars sit inside a row or popover instead of a page. */
  size?: "default" | "compact";
  className?: string;
}

/** Renders a determinate or indeterminate progress bar. */
export function Progress({
  value,
  max = 1,
  label,
  valueText,
  size = "default",
  className = "",
}: ProgressProps): React.JSX.Element {
  const ratio = progressRatio(value, max);
  const determinate = ratio !== null;
  return (
    <div
      className={`redux-progress${size === "compact" ? " redux-progress-compact" : ""}${
        className ? ` ${className}` : ""
      }`}
      role="progressbar"
      aria-label={label}
      aria-valuemin={determinate ? 0 : undefined}
      aria-valuemax={determinate ? max : undefined}
      aria-valuenow={determinate ? ratio * max : undefined}
      aria-valuetext={determinate ? valueText : undefined}
      data-indeterminate={determinate ? undefined : "true"}
    >
      <span
        className="redux-progress-fill"
        style={determinate ? { width: `${ratio * 100}%` } : undefined}
      />
    </div>
  );
}
