/**
 * Turns event easing and bezier definitions into cached sampled curves and strokes
 * them on the timeline event canvas.
 *
 * Values and easing math come from core chart helpers; this module owns canvas
 * sampling, shape caching, and stroke selection.
 */
import { bezier, easing } from "../../../../../../core/utils/easing.ts";
import { eventValueNumber } from "../../../../../../core/edit/timeline/model.ts";
import type { JudgeLineEvent } from "../../../../../../core/global/chart/chart.ts";
import type { EventChain } from "../../../../../../core/edit/timeline/eventChains.ts";
import type { CanvasPalette } from "../../../canvas/palette.ts";

/**
 * The stroke colour of an event curve.
 *
 * Selection is the only reason one curve differs from the others.
 */
export function eventCurveStroke(palette: CanvasPalette, selected: boolean): string {
  return selected ? palette.eventSelectedStroke : palette.eventStroke;
}

interface CurveOptions {
  steps?: number;
  padding?: number;
  lineWidth?: number;
  drawConstant?: boolean;
  append?: boolean;
}

interface CurveEntry {
  event: JudgeLineEvent;
  range: EventChain<JudgeLineEvent>;
  startY: number;
  endY: number;
}

const shapeCache = new Map<string, readonly number[]>();
const eventShapeCache = new WeakMap<JudgeLineEvent, { key: string; samples: readonly number[] }>();

/** Sampled easing values for one event, memoized by shape key. */
function curveShape(event: JudgeLineEvent, steps: number): readonly number[] {
  const start = eventValueNumber(event.start);
  const end = eventValueNumber(event.end);
  const points = event.bezierPoints;
  const key =
    start === end || (!event.bezier && (event.easingType ?? 1) === 1)
      ? "linear"
      : event.bezier
        ? `b:${steps}:${Array.isArray(points) ? points.join(",") : ""}`
        : `e:${steps}:${event.easingType ?? 1}:${event.easingLeft ?? 0}:${event.easingRight ?? 1}`;
  const previous = eventShapeCache.get(event);
  if (previous?.key === key) {
    return previous.samples;
  }
  let samples = shapeCache.get(key);
  if (!samples) {
    samples =
      key === "linear"
        ? [0, 1]
        : Array.from({ length: steps + 1 }, (_, step) => {
            const progress = step / steps;
            return event.bezier
              ? bezier(progress, points ?? [])
              : easing(progress, event.easingType, event.easingLeft ?? 0, event.easingRight ?? 1);
          });
    if (shapeCache.size >= 256) {
      const oldest = shapeCache.keys().next().value;
      if (oldest !== undefined) {
        shapeCache.delete(oldest);
      }
    }
    shapeCache.set(key, samples);
  }
  eventShapeCache.set(event, { key, samples });
  return samples;
}

/** Stroke one event's sampled value curve inside `rectangle`; `append` adds to the current path. */
export function drawEventCurve(
  context: CanvasRenderingContext2D,
  event: JudgeLineEvent,
  range: EventChain<JudgeLineEvent> | undefined,
  rectangle: { x: number; y: number; width: number; height: number },
  startY: number,
  endY: number,
  options: CurveOptions = {},
): boolean {
  const start = eventValueNumber(event.start);
  const end = eventValueNumber(event.end);
  if (
    !range ||
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    !Number.isFinite(range.min) ||
    !Number.isFinite(range.max)
  ) {
    return false;
  }
  const span = range.max - range.min;
  if (span <= 0.01 && !options.drawConstant) {
    return false;
  }
  const steps = options.steps ?? 36;
  const padding = options.padding ?? 6;
  const samples = curveShape(event, steps);
  if (!options.append) {
    context.save();
    context.beginPath();
    context.rect(rectangle.x, rectangle.y, rectangle.width, rectangle.height);
    context.clip();
    context.lineWidth = options.lineWidth ?? 2;
    context.beginPath();
  }
  for (let step = 0; step < samples.length; step++) {
    const progress = step / (samples.length - 1);
    const value = start + (end - start) * samples[step];
    const normalized = span > 0.01 ? (value - range.min) / span : 0.5;
    const x = rectangle.x + padding + normalized * Math.max(1, rectangle.width - 2 * padding);
    const y = startY + (endY - startY) * progress;
    if (step === 0) {
      context.moveTo(x, y);
    } else {
      context.lineTo(x, y);
    }
  }
  if (!options.append) {
    context.stroke();
    context.restore();
  }
  return true;
}

/** Stroke a set of event curves with one shared clip and stroke pass. */
export function drawEventCurveBatch(
  context: CanvasRenderingContext2D,
  entries: readonly CurveEntry[],
  rectangle: { x: number; y: number; width: number; height: number },
  options: CurveOptions = {},
): void {
  if (!entries.length) {
    return;
  }
  context.save();
  context.beginPath();
  context.rect(rectangle.x, rectangle.y, rectangle.width, rectangle.height);
  context.clip();
  context.lineWidth = options.lineWidth ?? 2;
  context.beginPath();
  for (const entry of entries) {
    drawEventCurve(context, entry.event, entry.range, rectangle, entry.startY, entry.endY, {
      ...options,
      append: true,
    });
  }
  context.stroke();
  context.restore();
}
