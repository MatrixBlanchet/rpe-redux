/**
 * Section frame and heading for inspector and settings panels.
 *
 * `Section` owns the vertical rhythm and the optional divider; `SectionHeading`
 * owns the title/action row. Features pass content and keep their own surface
 * class when the section needs product-specific spacing.
 */
import type { ReactNode } from "react";

export interface SectionHeadingProps {
  children: ReactNode;
  as?: "h2" | "h3" | "h4" | "strong";
  actions?: ReactNode;
  className?: string;
}

/** One section title with an optional trailing action row. */
export function SectionHeading({
  children,
  as: Heading = "h3",
  actions,
  className = "",
}: SectionHeadingProps): React.JSX.Element {
  return (
    <div className={`redux-section-heading ${className}`.trim()}>
      <Heading className="redux-section-heading-title">{children}</Heading>
      {actions != null && <div className="redux-section-heading-actions">{actions}</div>}
    </div>
  );
}

export interface SectionProps {
  title: ReactNode;
  children: ReactNode;
  level?: 2 | 3 | 4;
  actions?: ReactNode;
  /** Draw the hairline below the section. Defaults to true. */
  separated?: boolean;
  className?: string;
}

/** A titled block with shared spacing and an optional divider. */
export function Section({
  title,
  children,
  level = 3,
  actions,
  separated = true,
  className = "",
}: SectionProps): React.JSX.Element {
  const Heading = `h${level}` as "h2" | "h3" | "h4";
  return (
    <section
      className={`redux-section ${className}`.trim()}
      data-separated={separated ? "true" : undefined}
    >
      <SectionHeading as={Heading} actions={actions}>
        {title}
      </SectionHeading>
      {children}
    </section>
  );
}
