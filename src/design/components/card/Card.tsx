/**
 * Shared card surface for settings previews, extension cards, and skin assets.
 *
 * The primitive owns the border, radius, background, and padding; the caller
 * keeps layout (grid rows, gaps) and product-specific typography. `as` keeps the
 * semantic element the content already needs (article, figure, section).
 */
import { forwardRef, type HTMLAttributes, type ReactNode } from "react";

export type CardTone = "default" | "raised" | "muted" | "control";

export interface CardProps extends HTMLAttributes<HTMLElement> {
  as?: "div" | "article" | "section" | "figure" | "li";
  tone?: CardTone;
  children?: ReactNode;
}

/** A bordered surface at one of the shared card tones. */
export const Card = forwardRef<HTMLElement, CardProps>(function Card(
  { as: Tag = "div", tone = "default", className = "", children, ...rest },
  ref,
) {
  return (
    <Tag {...rest} ref={ref as never} className={`redux-card ${className}`.trim()} data-tone={tone}>
      {children}
    </Tag>
  );
});
