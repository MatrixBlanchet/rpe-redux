/**
 * One labelled form row: label and description on the leading side, the control
 * and an optional reset action on the trailing side.
 *
 * Settings, script parameters, inspector forms, and prompt fields all need the
 * same relationship between a label, its control, and the explanation that
 * belongs to both. This primitive owns that relationship, the disabled and
 * hidden states, and the row dividers so a caller only supplies the control.
 */
import { useId, type ReactNode } from "react";

export type FieldRowDensity = "comfortable" | "compact";
export type FieldRowLayout = "split" | "inline" | "block";

export interface FieldRowProps {
  /** The control's id; the label points at it. */
  htmlFor?: string;
  label: ReactNode;
  /** Supporting copy shown under the label. */
  description?: ReactNode;
  /** The control the row labels. A function receives the control id and description id. */
  control: ReactNode | ((id: string, describedBy?: string) => ReactNode);
  /** A reset affordance reserved beside the control even while hidden. */
  reset?: ReactNode;
  /** A validation or failure message shown below the row. */
  error?: ReactNode;
  /** Content below both columns, such as an expression legend. */
  footer?: ReactNode;
  className?: string;
  density?: FieldRowDensity;
  layout?: FieldRowLayout;
  /** Top-align the two columns instead of centering short rows. */
  align?: "center" | "start";
  /** Dim the whole row and keep its reset affordance inert. */
  disabled?: boolean;
  /** Keep a row active when only one compound-control part is disabled. */
  partialDisabled?: boolean;
  /** Draw a hairline under the row; the final row in a list drops it. */
  divided?: boolean;
  /** Tint alternating rows in a long form list. */
  striped?: boolean;
  /** Give the row a pointer hover surface, as settings rows do. */
  hoverable?: boolean;
  /** Tooltip content for a row whose control carries no tip of its own. */
  tipDescription?: string;
  /** Prefix for generated description and error ids. */
  idPrefix?: string;
  hidden?: boolean;
  "data-setting"?: string;
  /** Optional control-kind hook for surfaces that style rows by control type. */
  "data-control"?: string;
}

/**
 * A labelled field row.
 *
 * The control callback receives a description id whenever supporting copy is
 * present. `idPrefix` supplies a stable id when a caller needs to reference it.
 */
export function FieldRow({
  htmlFor,
  label,
  description,
  control,
  reset,
  error,
  footer,
  className = "",
  density = "comfortable",
  layout = "split",
  align = "center",
  disabled = false,
  partialDisabled = false,
  divided = false,
  striped = false,
  hoverable = false,
  tipDescription,
  idPrefix,
  hidden,
  "data-setting": dataSetting,
  "data-control": dataControl,
}: FieldRowProps) {
  const generatedId = useId();
  const controlId = htmlFor ?? idPrefix ?? generatedId;
  const descriptionId = description ? `${idPrefix ?? generatedId}-description` : undefined;
  const errorId = error && idPrefix ? `${idPrefix}-error` : undefined;
  return (
    <div
      className={`redux-field-row${className ? ` ${className}` : ""}`}
      data-density={density}
      data-layout={layout}
      data-align={align}
      data-disabled={disabled || undefined}
      data-partial-disabled={partialDisabled || undefined}
      data-divided={divided || undefined}
      data-striped={striped || undefined}
      data-hoverable={hoverable || undefined}
      data-setting={dataSetting}
      data-control={dataControl}
      data-tip-desc={tipDescription}
      aria-disabled={disabled || undefined}
      hidden={hidden}
    >
      {layout !== "block" && (
        <div className="redux-field-label-column">
          <label htmlFor={controlId} className="redux-field-label">
            {label}
          </label>
          {description && (
            <span id={descriptionId} className="redux-field-description">
              {description}
            </span>
          )}
        </div>
      )}
      <div className="redux-field-control">
        {reset !== undefined && <span className="redux-field-reset-slot">{reset}</span>}
        {typeof control === "function" ? control(controlId, descriptionId) : control}
      </div>
      {error && (
        <span id={errorId} className="redux-field-error" role="alert">
          {error}
        </span>
      )}
      {footer && <div className="redux-field-footer">{footer}</div>}
    </div>
  );
}
