/**
 * Base button primitive shared by shell, inspector, and dialog surfaces.
 *
 * It owns keyboard/focus semantics and the visual variants (`ghost`,
 * `outlined`, `solid`, `plain`, `danger`); callers own labels and actions. It
 * knows no product action, chart state, or panel layout.
 *
 * `ghost` is the default: a dense row gets a hover fill without a border.
 * `plain` is for rows that paint their own hover surface (menu rows, list rows).
 * `outlined` adds an edge for standalone secondary actions and message boxes.
 * `solid` is the primary action and `danger` is destructive.
 */
import { forwardRef, type ButtonHTMLAttributes } from "react";
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  "data-tip-title"?: string;
  "data-tip-desc"?: string;
  "data-tip-key"?: string;
  "data-tip-action"?: string;
  "data-tip-video"?: string;
  /** Explicit surface variant; defaults to the dense `ghost` action. */
  variant?: "ghost" | "outlined" | "solid" | "plain" | "danger" | "link";
  /** Height and padding preset; `md` is the normal control and `lg` is page-level. */
  size?: "sm" | "md" | "lg";
  /** Tighter vertical rhythm for dense rows and cards. */
  density?: "default" | "compact";
  /** Fill the available inline space. */
  block?: boolean;
  /** Mark an icon-plus-label composition so the shared gap applies. */
  iconText?: boolean;
}
/** The shared button; forwards its ref to the native element and defaults to `type="button"`. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    className = "",
    type = "button",
    variant = "ghost",
    size = "md",
    density = "default",
    block = false,
    iconText = false,
    title,
    children,
    ...props
  },
  ref,
) {
  const classes = [
    "redux-button",
    `redux-button-${variant}`,
    `redux-button-${size}`,
    density === "compact" ? "redux-button-dense" : "",
    block ? "redux-button-block" : "",
    iconText ? "redux-button-icon-text" : "",
    variant === "ghost" ? "redux-action" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <button
      ref={ref}
      type={type}
      className={classes}
      {...props}
      data-tip-title={props["data-tip-title"] ?? title}
    >
      {children}
    </button>
  );
});
