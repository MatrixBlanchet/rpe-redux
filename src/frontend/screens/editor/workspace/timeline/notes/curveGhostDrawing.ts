/**
 * Draws the dashed preview path and note boxes for a pending note-curve gesture.
 *
 * The ghost comes from the gesture state and projection from the viewport; curve
 * commit rules remain in core.
 */
import { beatValue, isOrderedBeatRange } from "../../../../../../core/global/chart/timing/beat.ts";
import { noteColor, readCanvasPalette } from "../../../canvas/palette.ts";
import type { TimelineCurveGhostReceiver } from "../drawing/timelineReceiver.ts";

/** Draw the dashed path and note boxes previewing a pending note curve. */
export function drawCurveGhost(
  this: TimelineCurveGhostReceiver,
  context: CanvasRenderingContext2D,
): void {
  const ghost = (() => {
    try {
      return this.gestures.curveGhost?.() ?? [];
    } catch {
      return [];
    }
  })();
  const renderableGhost = ghost.filter((note) => isOrderedBeatRange(note.startTime, note.endTime));
  if (renderableGhost.length) {
    const palette = this.cache.palette() ?? readCanvasPalette();
    context.save();
    context.globalAlpha = 0.5;
    context.strokeStyle = palette.bottomValue;
    context.fillStyle = noteColor(palette, renderableGhost[0].type);
    context.lineWidth = 2.5;
    context.setLineDash([6, 3]);
    context.beginPath();
    renderableGhost.forEach((note, index) => {
      const horizontal = this.viewport.noteHorizontal(note.positionX);
      const vertical = this.viewport.vertical(beatValue(note.startTime));
      if (index === 0) {
        context.moveTo(horizontal, vertical);
      } else {
        context.lineTo(horizontal, vertical);
      }
    });
    context.stroke();
    context.setLineDash([]);
    for (const note of renderableGhost) {
      if (note.existing) {
        continue;
      }
      const horizontal = this.viewport.noteHorizontal(note.positionX);
      const vertical = this.viewport.vertical(beatValue(note.startTime));
      const width = 52 * this.viewport.renderNoteScale;
      const renderedHorizontal = this.viewport.clampNoteHorizontal(horizontal, width);
      if (renderedHorizontal == null) {
        continue;
      }
      context.fillRect(renderedHorizontal - width / 2, vertical - 5, width, 10);
      context.strokeRect(renderedHorizontal - width / 2 - 2, vertical - 7, width + 4, 14);
    }
    context.restore();
  }
}
