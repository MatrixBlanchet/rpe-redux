/**
 * Owns the selection overlay canvas and the window-level pointer listeners that keep a
 * rectangle drag alive outside the timeline.
 *
 * It paints from the timeline's public selection state and leaves selection rules to
 * the timeline and core.
 */
import type { ResourceScope } from "../../../../../../core/utils/resourceScope.ts";
import { prepareCanvas } from "../../../canvas/canvas2d.ts";
import { readCanvasPalette, rgbChannels, selectionColor } from "../../../canvas/palette.ts";
import { type Timeline } from "../surface/timeline.ts";
import { drawPreviewMarquee } from "../../preview/interaction/previewSelection.ts";
import { drawMarqueeRectangle } from "./selectionOverlayDrawing.ts";

/** Event target shape needed for the line-switcher exclusion check. */
interface ClosestTarget {
  closest?: (selector: string) => unknown;
}

/** Marquee rectangle drawn above the timeline using only its public state. */
export class SelectionOverlay {
  timeline: Timeline;
  canvas: HTMLCanvasElement;
  private hasPaintedSelection = false;

  /** Attach marquee listeners and mark the timeline as overlay-driven. */
  constructor(
    stage: HTMLElement,
    canvas: HTMLCanvasElement,
    timeline: Timeline,
    scope: ResourceScope,
  ) {
    this.timeline = timeline;
    this.canvas = canvas;
    scope.listen(
      window,
      "pointermove",
      (event: PointerEvent) => timeline.updateRectangle(event),
      true,
    );
    const finishWindowDrag = (event: PointerEvent) => {
      if (!timeline.rectangleSelection()) {
        return;
      }
      if (timeline.finishRectangle(event)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };
    scope.listen(window, "pointerup", finishWindowDrag, true);
    scope.listen(window, "pointercancel", finishWindowDrag, true);
    scope.listen(
      stage,
      "pointerdown",
      (event) => {
        const target = event.target as ClosestTarget | null;
        if (target?.closest?.(".line-switcher")) {
          return;
        }
        if (timeline.finishRectangle(event)) {
          event.preventDefault();
          event.stopImmediatePropagation();
        }
      },
      true,
    );
  }

  /** Paint or clear the marquee above the timeline canvases. */
  draw(): void {
    const previewMarquee = this.timeline.gestures.previewMarquee;
    const selection = this.timeline.rectangleSelection();
    if (!previewMarquee && !selection) {
      if (this.hasPaintedSelection) {
        prepareCanvas(this.canvas);
        this.hasPaintedSelection = false;
      }
      return;
    }

    const { context } = prepareCanvas(this.canvas);
    if (previewMarquee) {
      drawPreviewMarquee(context, previewMarquee.start, previewMarquee.current);
      this.hasPaintedSelection = true;
      return;
    }
    if (!selection) {
      this.hasPaintedSelection = false;
      return;
    }
    const origin = selection.canvas.getBoundingClientRect();
    const overlay = this.canvas.getBoundingClientRect();
    const start = this.timeline.rectangleStart(selection.drag);
    const { current } = selection.drag;
    const palette = this.timeline.cache.palette() ?? readCanvasPalette();
    const noteColor = selectionColor("timeline-note-marquee-color", "#006400");
    const eventColor = selectionColor("timeline-event-marquee-color", "#644B50");
    const noteRgb = rgbChannels(noteColor) ?? [0, 100, 0];
    const eventRgb = rgbChannels(eventColor) ?? [100, 75, 80];
    drawMarqueeRectangle(
      context,
      { left: origin.left, top: origin.top },
      { left: overlay.left, top: overlay.top },
      start,
      current,
      selection.area,
      {
        ...palette,
        selectionNotesFill: `rgba(${noteRgb.join(", ")}, 0.13)`,
        selectionNotesStroke: noteColor,
        selectionEventsFill: `rgba(${eventRgb.join(", ")}, 0.19)`,
        selectionEventsStroke: eventColor,
      },
    );
    this.hasPaintedSelection = true;
  }
}
