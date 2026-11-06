/**
 * One entry in a right-hand navigation rail.
 *
 * The compact rail renders only the icon slot; the caller supplies `tooltip`
 * so the shared tooltip layer shows the label. The horizontal top bar passes
 * `expanded` to render the label inline instead. The caller supplies the
 * destination and any status dot; the primitive owns the rail anatomy.
 */
import type { ReactNode, Ref } from "react";
import { Button } from "../components/button/Button.tsx";
import { Icon, type IconName } from "../components/icon/Icon.tsx";

export interface RailNavItemProps {
  label: string;
  icon: IconName | ReactNode;
  iconSize?: number;
  selected?: boolean;
  /** Render the label inline for the horizontal top bar. */
  expanded?: boolean;
  /** Show the label as a tooltip while the rail is compact. */
  tooltip?: boolean;
  /** The entry represents the current page rather than a pressed toggle. */
  current?: boolean;
  /** Render the current destination as a non-interactive marker. */
  disabled?: boolean;
  id?: string;
  className?: string;
  /** Native button ref for focus return; ignored by the non-interactive row. */
  elementRef?: Ref<HTMLButtonElement>;
  statusDot?: boolean;
  onClick?(): void;
  "data-pane"?: string;
  "data-drawer-pane"?: string;
}

/** A rail row; the caller's rail supplies the placement and tooltip policy. */
export function RailNavItem({
  label,
  icon,
  iconSize = 20,
  selected = false,
  expanded = false,
  tooltip = true,
  current = false,
  disabled = false,
  id,
  className = "",
  elementRef,
  statusDot = false,
  onClick,
  "data-pane": dataPane,
  "data-drawer-pane": dataDrawerPane,
}: RailNavItemProps) {
  const tip = tooltip && !expanded ? label : undefined;
  const classes = `redux-rail-item${selected ? " is-selected" : ""}${className ? ` ${className}` : ""}`;
  const content = (
    <>
      {expanded && <span className="redux-rail-item-label">{label}</span>}
      <span className="redux-rail-item-icon">
        {typeof icon === "string" ? <Icon name={icon as IconName} size={iconSize} /> : icon}
        {statusDot && <span className="redux-rail-status-dot" aria-hidden="true" />}
      </span>
    </>
  );
  if (!onClick) {
    return (
      <div
        id={id}
        className={classes}
        aria-label={label}
        aria-current={current ? "page" : undefined}
        data-tip-title={tip}
        data-pane={dataPane}
        data-drawer-pane={dataDrawerPane}
      >
        {content}
      </div>
    );
  }
  return (
    <Button
      ref={elementRef}
      id={id}
      type="button"
      variant="plain"
      className={classes}
      aria-label={label}
      aria-current={current ? "page" : undefined}
      aria-pressed={selected && !current ? true : undefined}
      data-tip-title={tip}
      data-pane={dataPane}
      data-drawer-pane={dataDrawerPane}
      disabled={disabled}
      onClick={onClick}
    >
      {content}
    </Button>
  );
}
