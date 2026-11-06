/**
 * Inline feedback for a form, panel, or modal body.
 *
 * The primitive owns one bordered surface for errors, warnings, and neutral
 * notes, so callers no longer invent their own danger/warning box. `role`
 * defaults to `alert` for danger and `status` for every other tone; a caller may
 * override it when the message is part of a larger live region.
 */
import type { ReactNode } from "react";

export type InlineAlertTone = "info" | "success" | "warning" | "danger";

export interface InlineAlertProps {
  tone?: InlineAlertTone;
  role?: "alert" | "status" | "note";
  title?: string;
  action?: ReactNode;
  className?: string;
  children?: ReactNode;
}

/** One inline alert with a tone, optional title, and optional trailing action. */
export function InlineAlert({
  tone = "danger",
  role,
  title,
  action,
  className = "",
  children,
}: InlineAlertProps): React.JSX.Element {
  return (
    <div
      className={`redux-inline-alert ${className}`.trim()}
      data-tone={tone}
      role={role ?? (tone === "danger" ? "alert" : "status")}
    >
      <div className="redux-inline-alert-body">
        {title && <strong>{title}</strong>}
        {children != null && <div className="redux-inline-alert-content">{children}</div>}
      </div>
      {action != null && <div className="redux-inline-alert-action">{action}</div>}
    </div>
  );
}
