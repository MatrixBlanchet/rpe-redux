/**
 * Disclosure primitive built on native `<details>`.
 *
 * The reset owns the summary row's pointer, hover, focus, and animated content
 * rules; this component owns the element shape and the open-state callback so
 * features do not hand-write `<details>/<summary>` pairs. Native disclosure
 * keeps its keyboard and accessibility semantics.
 */
import { forwardRef, type DetailsHTMLAttributes, type ReactNode } from "react";

export interface DisclosureProps extends Omit<
  DetailsHTMLAttributes<HTMLDetailsElement>,
  "children" | "onToggle"
> {
  /** The summary row content. */
  summary: ReactNode;
  children: ReactNode;
  summaryClassName?: string;
  /** Called with the new open state after the user toggles the disclosure. */
  onOpenChange?(open: boolean): void;
}

/** A native disclosure with one shared summary and open-state contract. */
export const Disclosure = forwardRef<HTMLDetailsElement, DisclosureProps>(function Disclosure(
  { summary, children, className = "", summaryClassName = "", onOpenChange, ...props },
  ref,
) {
  return (
    <details
      ref={ref}
      className={`redux-disclosure ${className}`.trim()}
      {...props}
      onToggle={(event) => onOpenChange?.(event.currentTarget.open)}
    >
      <summary className={summaryClassName}>{summary}</summary>
      {children}
    </details>
  );
});
