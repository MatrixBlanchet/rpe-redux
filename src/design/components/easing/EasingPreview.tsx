/**
 * Canvas drawing of one easing curve, independent of the shipped curve images.
 *
 * The picture answers three questions at once: which family the curve belongs to,
 * which part of it the left/right bounds cut out (the bright segment, with the
 * discarded part dimmed), and — when Bézier is on — what the control points draw.
 * It only reads the easing fields, so a chart event or a shader segment can be
 * passed unchanged.
 *
 * Sampling uses the same `easing`/`bezier` functions the renderer uses, so the
 * drawing cannot drift from the animation. The base curve is sampled with no
 * bounds (`easing(t, type, 0, 1)`) on purpose: the bounds select a sub-range of
 * that curve, and drawing the composed value would hide which segment was cut.
 */
import { useEffect, useRef } from "react";
import { bezier, easing } from "../../../core/utils/easing.ts";
import { clamp01 } from "../../../core/utils/numbers.ts";

/**
 * Only the fields the preview draws. Naming the shape here keeps chart-model
 * knowledge out of the design layer: a caller passes its own event and it is
 * structurally compatible, without `src/design/` importing `core/global/chart/`.
 */
interface EasingPreviewEvent {
  // Mirrors the chart model's own field types (`bezier` is a 0/1 flag there),
  // so a caller can pass its event unchanged.
  bezier?: number | boolean;
  bezierPoints?: readonly number[];
  easingType?: number;
  easingLeft?: number;
  easingRight?: number;
}

const WIDTH = 260;
const HEIGHT = 100;
const LEFT = 10;
const TOP = 12;
const BOTTOM = 88;
const PLOT_WIDTH = WIDTH - LEFT * 2;
// Back/Elastic leave the 0..1 band; a margin keeps their overshoot inside the box.
const RANGE_MIN = -0.15;
const RANGE_MAX = 1.15;

const xOf = (progress: number): number => LEFT + progress * PLOT_WIDTH;
const yOf = (value: number): number =>
  BOTTOM - ((value - RANGE_MIN) / (RANGE_MAX - RANGE_MIN)) * (BOTTOM - TOP);

/** Stroke one sampled segment of a curve into the canvas. */
function drawCurve(
  draw: CanvasRenderingContext2D,
  from: number,
  to: number,
  curve: (progress: number) => number,
): void {
  draw.beginPath();
  for (let index = 0; index <= 120; index++) {
    const progress = from + ((to - from) * index) / 120;
    const value = curve(progress);
    if (!Number.isFinite(value)) {
      continue;
    }
    if (index === 0) {
      draw.moveTo(xOf(progress), yOf(value));
    } else {
      draw.lineTo(xOf(progress), yOf(value));
    }
  }
  draw.stroke();
}

/** Draws the easing curve, its active bounds, and its control points for one event. */
export function EasingPreview({ event }: { event: EasingPreviewEvent }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { bezier: isBezier, bezierPoints, easingType, easingLeft, easingRight } = event;

  useEffect(() => {
    const canvas = canvasRef.current;
    const draw = canvas?.getContext("2d");
    if (!canvas || !draw) {
      return;
    }
    const style = getComputedStyle(canvas);
    const accent = style.getPropertyValue("--accent").trim();
    const quiet = style.getPropertyValue("--foreground-muted").trim();
    if (!accent || !quiet) {
      return;
    }
    draw.clearRect(0, 0, WIDTH, HEIGHT);

    // The 0 and 1 levels: a curve that leaves this band is overshooting.
    draw.strokeStyle = quiet;
    draw.lineWidth = 1;
    draw.setLineDash([2, 3]);
    for (const level of [0, 1]) {
      draw.beginPath();
      draw.moveTo(xOf(0), yOf(level));
      draw.lineTo(xOf(1), yOf(level));
      draw.stroke();
    }
    draw.setLineDash([]);

    if (isBezier) {
      const points = bezierPoints ?? [];
      draw.strokeStyle = quiet;
      draw.setLineDash([3, 3]);
      draw.beginPath();
      draw.moveTo(xOf(0), yOf(0));
      draw.lineTo(xOf(points[0] ?? 0), yOf(points[1] ?? 0));
      draw.moveTo(xOf(1), yOf(1));
      draw.lineTo(xOf(points[2] ?? 1), yOf(points[3] ?? 1));
      draw.stroke();
      draw.setLineDash([]);
      draw.strokeStyle = accent;
      draw.lineWidth = 2;
      drawCurve(draw, 0, 1, (progress) => bezier(progress, points));
      return;
    }

    const left = clamp01(easingLeft ?? 0);
    const right = clamp01(easingRight ?? 1);
    const type = easingType ?? 1;
    const curve = (progress: number) => easing(progress, type, 0, 1);
    draw.strokeStyle = quiet;
    draw.lineWidth = 1.5;
    drawCurve(draw, 0, 1, curve);
    if (right > left) {
      // The kept sub-range: the same curve, brighter, plus its two edges.
      draw.strokeStyle = accent;
      draw.lineWidth = 2;
      drawCurve(draw, left, right, curve);
      draw.strokeStyle = quiet;
      draw.lineWidth = 1;
      draw.setLineDash([3, 3]);
      for (const boundary of [left, right]) {
        draw.beginPath();
        draw.moveTo(xOf(boundary), TOP);
        draw.lineTo(xOf(boundary), BOTTOM);
        draw.stroke();
      }
      draw.setLineDash([]);
    }
  }, [isBezier, bezierPoints, easingType, easingLeft, easingRight]);

  return (
    <canvas
      ref={canvasRef}
      width={WIDTH}
      height={HEIGHT}
      className="easing-preview"
      aria-hidden="true"
    />
  );
}
