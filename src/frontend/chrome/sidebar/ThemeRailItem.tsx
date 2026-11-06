/**
 * One rail entry, optionally rendered from the theme's `railItem` template.
 *
 * The shell still owns the button/navigation wrapper, label, action, and ARIA;
 * the theme only replaces the content anatomy. Without a template, this is the
 * existing design-system `RailNavItem`.
 */
import { useThemeUi } from "../../app/useThemeUi.ts";
import { Button } from "../../../design/components/button/Button.tsx";
import { RailNavItem, type RailNavItemProps } from "../../../design/patterns/RailNavItem.tsx";
import { ThemeUiNodeView } from "../../platform/themeUi.tsx";

/** Renders the host rail wrapper around either the default or themed anatomy. */
export function ThemeRailItem({
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
  const ui = useThemeUi();
  const template = ui.components.railItem;
  // A React-node icon has no name for the declarative `icon` binding.
  if (!template || typeof icon !== "string") {
    return (
      <RailNavItem
        label={label}
        icon={icon}
        iconSize={iconSize}
        selected={selected}
        expanded={expanded}
        tooltip={tooltip}
        current={current}
        disabled={disabled}
        id={id}
        className={className}
        elementRef={elementRef}
        statusDot={statusDot}
        onClick={onClick}
        data-pane={dataPane}
        data-drawer-pane={dataDrawerPane}
      />
    );
  }
  const classes = `theme-rail-item${className ? ` ${className}` : ""}`;
  const tip = tooltip && !expanded ? label : undefined;
  const content = (
    <ThemeUiNodeView
      tree={template}
      bindings={{
        label,
        icon,
        active: selected,
        statusDot,
        expanded,
        onActivate: onClick,
      }}
    />
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
