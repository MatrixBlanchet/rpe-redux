/**
 * The one empty-state line for Inspector panes.
 *
 * A pane that has nothing selected should explain the next action in one short
 * paragraph, centered in the body it leaves empty. The root inspector keeps its
 * own page-level placeholder; this is for the pane content.
 */
import type { ReactNode } from "react";

/** Renders the pane's short empty-state hint. */
export function InspectorEmpty({ children }: { children: ReactNode }) {
  return <p className="inspector-empty-hint">{children}</p>;
}
