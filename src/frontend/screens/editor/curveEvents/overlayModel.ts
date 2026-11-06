/**
 * Shared gesture shapes and small helpers for the curve overlay's pointer tools.
 *
 * The overlay component owns behavior; these types describe drags, drafts, and
 * pans so the pointer handlers can share them.
 */
import type { MessageKey } from "../../../../i18n/index.ts";
import type { OverlayHandle } from "./drawOverlay.ts";
import type { CurveTool } from "./curveTools.ts";
import type { CurvePathComponent, CurvePathPoint } from "./pathModel.ts";

/** A point in screen pixels, relative to the overlay layer. */
export interface WindowPosition {
  x: number;
  y: number;
}

export interface CanvasDrag {
  kind: "component" | "handle" | "rotate";
  componentId: string;
  handle?: OverlayHandle;
  /** Rotation centre, in chart coordinates. */
  center?: CurvePathPoint;
  last?: CurvePathPoint;
  lastAngle?: number;
  /** Whether this gesture has already recorded its undo step. */
  tracked?: boolean;
}

export interface Draft {
  kind: "pencil" | "line" | "polyline" | "curve";
  points: CurvePathPoint[];
}

/** A canvas pan in progress, in screen pixels. */
export interface PanDrag {
  startX: number;
  startY: number;
  panX: number;
  panY: number;
  moved: boolean;
  /** An empty-background click in select mode clears the selection on release. */
  deselectOnClick: boolean;
}

/** Hint message key for each tool. */
export const TOOL_HINTS: Record<CurveTool, MessageKey> = {
  pencil: "editorPanels.curvePreview.hint.pencil",
  line: "editorPanels.curvePreview.hint.line",
  polyline: "editorPanels.curvePreview.hint.polyline",
  curve: "editorPanels.curvePreview.hint.curve",
  select: "editorPanels.curvePreview.hint.select",
  connect: "editorPanels.curvePreview.hint.connect",
  subdivide: "editorPanels.curvePreview.hint.subdivide",
};

/** Return a copy of the component with every segment point shifted by `delta`. */
export function translateComponent(
  component: CurvePathComponent,
  delta: CurvePathPoint,
): CurvePathComponent {
  const move = (entry: CurvePathPoint) => ({ x: entry.x + delta.x, y: entry.y + delta.y });
  return {
    ...component,
    segments: component.segments.map((segment) => ({
      p0: move(segment.p0),
      p1: move(segment.p1),
      p2: move(segment.p2),
      p3: move(segment.p3),
    })),
  };
}

/** Whether keyboard input currently belongs to a text field. */
export function isTextTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}

/** Whether the double-click gesture commits this draft (polyline and curve only). */
export function finishesOnDoubleClick(draft: Draft | null): boolean {
  return draft?.kind === "polyline" || draft?.kind === "curve";
}
