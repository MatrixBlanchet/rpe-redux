/**
 * One selectable row in a list, tree, or two-column picker.
 *
 * The primitive owns hover, selected, current, dragging, and focus feedback; the
 * caller keeps the row's grid/flex layout and its own leading/trailing controls.
 */
import { forwardRef, type HTMLAttributes, type ReactNode } from "react";

export interface ListRowProps extends HTMLAttributes<HTMLElement> {
  as?: "div" | "li" | "button";
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  selected?: boolean;
  current?: boolean;
  dragging?: boolean;
  children?: ReactNode;
  [key: `data-${string}`]: unknown;
}

/** A row surface with the shared selected/hover/dragging states. */
export const ListRow = forwardRef<HTMLElement, ListRowProps>(function ListRow(
  {
    as: Tag = "div",
    selected = false,
    current = false,
    dragging = false,
    className = "",
    children,
    ...rest
  },
  ref,
) {
  const classes = [
    "redux-list-row",
    selected ? "is-selected" : "",
    current ? "is-current" : "",
    dragging ? "is-dragging" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <Tag
      {...rest}
      ref={ref as never}
      className={classes}
      data-selected={selected ? "true" : undefined}
      data-current={current ? "true" : undefined}
      data-dragging={dragging ? "true" : undefined}
    >
      {children}
    </Tag>
  );
});
