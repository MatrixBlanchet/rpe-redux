/**
 * Paints event overlap and selection tints beneath the event bars and value
 * labels.
 *
 * Both helpers are pure canvas passes: rectangles and palette arrive from the
 * event drawing module.
 */
import type { CanvasPalette } from "../../../canvas/palette.ts";
import type { TimelineEventRect } from "../../../../../../core/edit/timeline/types.ts";

type EventBarRectangle = Pick<TimelineEventRect, "x" | "y" | "width" | "height">;

/** Paints a stable per-event overlap tint below the event value labels. */
export function drawEventOverlapFilter(
  context: CanvasRenderingContext2D,
  rectangle: EventBarRectangle,
  palette: CanvasPalette,
): void {
  context.save();
  context.fillStyle = palette.overlayInvalidFill;
  context.fillRect(rectangle.x, rectangle.y, rectangle.width, rectangle.height);
  context.restore();
}

/** Paint the selection tint below the event bars and value labels. */
export function drawEventSelectionFilters(
  context: CanvasRenderingContext2D,
  rectangles: readonly EventBarRectangle[],
  palette: CanvasPalette,
): void {
  context.save();
  context.fillStyle = palette.selectionHighlight;
  for (const rectangle of rectangles) {
    context.fillRect(rectangle.x, rectangle.y, rectangle.width, rectangle.height);
  }
  context.restore();
}
