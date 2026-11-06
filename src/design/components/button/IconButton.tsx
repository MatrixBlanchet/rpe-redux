/**
 * Square icon-only button built on `Button`: owns the accessible label, active
 * state, tooltip, and close variant. It carries no product action; callers pass
 * the icon, label, and press handler.
 */
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { Button, type ButtonProps } from "./Button.tsx";
import { Icon, type IconName } from "../icon/Icon.tsx";
/** An icon-only `Button` whose label is both the accessible name and the default tooltip. */
export const IconButton = forwardRef<
  HTMLButtonElement,
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "ref"> & {
    icon: IconName;
    iconSource?: string;
    label: string;
    "data-tip-desc"?: string;
    /** Whether the label also appears as a hover tooltip. Defaults to true. */
    tooltip?: boolean;
    active?: boolean;
    /** Glyph size in pixels, or a box preset (`small` 24, `md` 32, `caption` 46). */
    size?: number | "small" | "md" | "caption";
    /** Compact in-field control; uses the 18px box instead of the standard target. */
    compact?: boolean;
    variant?: ButtonProps["variant"];
  }
>(function IconButton(
  {
    icon,
    iconSource,
    label,
    active,
    tooltip = true,
    size = 20,
    compact = false,
    title,
    className = "",
    variant,
    children,
    ...props
  },
  ref,
) {
  const surface = variant ?? (icon === "close" ? "plain" : "ghost");
  const box = typeof size === "string" ? size : "md";
  const glyphSize =
    typeof size === "number" ? size : size === "small" || size === "caption" ? 16 : 20;
  return (
    <Button
      ref={ref}
      {...props}
      aria-label={label}
      aria-pressed={active}
      data-tip-title={tooltip ? (title ?? label) : undefined}
      variant={surface}
      className={`redux-icon-button redux-icon-button-${box} ${icon === "close" ? "redux-close-button" : ""} ${compact ? "redux-icon-button-compact" : ""} ${active ? "active" : ""} ${className}`}
    >
      <Icon name={icon} size={glyphSize} source={iconSource} />
      <span className="redux-visually-hidden">{label}</span>
      {children}
    </Button>
  );
});
