/**
 * Read-only geometry seam for host UI layout anchors.
 *
 * The host publishes named rectangles and control labels only. Extensions never
 * receive DOM nodes, input values, or arbitrary selectors, so a consumer can
 * position its own overlay without gaining a second route into the application.
 */
import { createLateBound } from "../../utils/lateBound.ts";

export interface LayoutRect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

export type LayoutAnchorKind = "region" | "control";

export interface LayoutAnchor {
  /** Stable host-owned id, or a tag/index fallback for controls without an id. */
  readonly id: string;
  readonly kind: LayoutAnchorKind;
  /** Human-readable host label; never an input value. */
  readonly label: string;
  /** Rectangle in client (application viewport) CSS pixels. */
  readonly client: LayoutRect;
}

export interface LayoutSnapshot {
  readonly anchors: readonly LayoutAnchor[];
}

export interface LayoutApiHost {
  anchors(): readonly LayoutAnchor[];
}

const layoutApiBinding = createLateBound<LayoutApiHost>();

/** Binds the host that owns layout anchors; returns an idempotent disposer. */
export function connectLayoutApi(host: LayoutApiHost): () => void {
  return layoutApiBinding.bind(host);
}

/** The mounted layout host, or null while no host is bound. */
export function getLayoutApi(): LayoutApiHost | null {
  return layoutApiBinding.value();
}
