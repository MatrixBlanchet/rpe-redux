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
import { useEffect, useRef, useState } from "react";
import { bezier, easing } from "../../../core/utils/easing.ts";
import { clamp01 } from "../../../core/utils/numbers.ts";
import { EASING_CANVAS_HEIGHT, EASING_CANVAS_WIDTH, resizeEasingCanvas } from "./easingCanvas.ts";

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

const WIDTH = EASING_CANVAS_WIDTH;
const HEIGHT = EASING_CANVAS_HEIGHT;
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
const VALUE_TOP = yOf(1);
const VALUE_BOTTOM = yOf(0);

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
  const [drawVersion, setDrawVersion] = useState(0);
  const { bezier: isBezier, bezierPoints, easingType, easingLeft, easingRight } = event;

  useEffect(() => {
    const redraw = () => setDrawVersion((version) => version + 1);
    window.addEventListener("redux-theme", redraw);
    const canvas = canvasRef.current;
    const observer =
      canvas && typeof ResizeObserver !== "undefined" ? new ResizeObserver(redraw) : null;
    if (observer && canvas) {
      observer.observe(canvas);
    }
    redraw();
    return () => {
      window.removeEventListener("redux-theme", redraw);
      observer?.disconnect();
    };
  }, []);

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
    const rect = canvas.getBoundingClientRect();
    const { pixelWidth, pixelHeight, scaleX, scaleY } = resizeEasingCanvas(
      canvas,
      rect.width || WIDTH,
      rect.height || HEIGHT,
    );
    draw.setTransform(1, 0, 0, 1, 0, 0);
    draw.clearRect(0, 0, pixelWidth, pixelHeight);
    draw.setTransform(scaleX, 0, 0, scaleY, 0, 0);

    // The unit range is the closed frame; overshooting curves remain visible in
    // the breathing room outside it without making any frame edge protrude.
    draw.strokeStyle = quiet;
    draw.lineWidth = 1;
    draw.setLineDash([2, 3]);
    draw.strokeRect(LEFT, VALUE_TOP, PLOT_WIDTH, VALUE_BOTTOM - VALUE_TOP);
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
        if (boundary <= 0 || boundary >= 1) {
          continue;
        }
        draw.beginPath();
        draw.moveTo(xOf(boundary), VALUE_TOP);
        draw.lineTo(xOf(boundary), VALUE_BOTTOM);
        draw.stroke();
      }
      draw.setLineDash([]);
    }
  }, [drawVersion, isBezier, bezierPoints, easingType, easingLeft, easingRight]);

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
