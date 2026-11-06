/**
 * A centered placeholder for a workspace with no authored objects.
 *
 * Empty workspaces still keep their footer actions; this primitive only explains
 * the state so the page does not read as a loading failure or a broken tree. The
 * inline variant is for an empty folder, search result, or picker inside a
 * larger surface where a full-height placeholder would push the layout around.
 */
import type { ReactNode } from "react";
import { Icon, type IconName } from "../icon/Icon.tsx";

/**
 * Announces an empty workspace or list with a title and optional explanation.
 *
 * `illustration` is a full-variant slot above the title; it replaces `icon` when
 * both are supplied. `actions` adds an optional recovery row below the copy.
 * The inline variant keeps its compact text-only layout.
 */
export function EmptyState({
  icon,
  illustration,
  title,
  description,
  actions,
  variant = "full",
  className = "",
}: {
  icon?: IconName;
  illustration?: ReactNode;
  title: string;
  description?: string;
  actions?: ReactNode;
  variant?: "full" | "inline";
  className?: string;
}): React.JSX.Element {
  if (variant === "inline") {
    return (
      <div
        className={`redux-empty-state redux-empty-state-inline ${className}`.trim()}
        role="status"
      >
        <strong>{title}</strong>
        {description && <p>{description}</p>}
      </div>
    );
  }
  return (
    <div className={`redux-empty-state ${className}`.trim()} role="status">
      {illustration ??
        (icon && (
          <span className="redux-empty-state-icon" aria-hidden="true">
            <Icon name={icon} size={22} />
          </span>
        ))}
      <strong>{title}</strong>
      {description && <p>{description}</p>}
      {actions && <div className="redux-empty-state-actions">{actions}</div>}
    </div>
  );
}
