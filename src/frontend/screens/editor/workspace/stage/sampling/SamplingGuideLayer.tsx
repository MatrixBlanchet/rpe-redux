/**
 * SVG guide layer for the workspace sampler.
 *
 * It paints the full-viewport XY guide lines, the scalar ruler, the two draft
 * anchors, and the drag path. All geometry arrives precomputed so this file
 * only decides visibility, opacity, and snap highlighting; interaction state
 * stays in the overlay and the sampling session.
 */
import { useId } from "react";
import {
  isScalarAxis,
  type SamplingGuideCursor,
  type SamplingGeometry,
  type SamplingProjection,
  type SamplingRulerTick,
  type SamplingViewport,
} from "./samplingGuides.ts";
import type { SamplingAxis, SamplingValue } from "../../../../../../core/edit/sampling/sampling.ts";

interface SamplingGuideLayerProps {
  projection: SamplingProjection;
  viewport: SamplingViewport;
  axis: SamplingAxis;
  geometry: SamplingGeometry;
  start: SamplingValue | null;
  end: SamplingValue | null;
  startPoint: { x: number; y: number } | null;
  endPoint: { x: number; y: number } | null;
  /** Guide lines and ruler ticks are painted when true. */
  showGuides: boolean;
  /** Draft anchor markers, their crosshairs, and the path are painted when true. */
  showAnchors: boolean;
  /** Stage-local pointer position used to reveal guides outside the frame. */
  cursor: SamplingGuideCursor | null;
  /** Opacity multiplier shared by every sampler helper line. */
  guideOpacity: number;
}

/** Rotation ray length in stage pixels. */
const ROTATION_RAY_LENGTH = 96;
/** Minimum vertical gap between two ruler labels, in stage pixels. */
const RULER_LABEL_GAP = 18;
/** Stage-pixel distance under which a guide counts as snapped. */
const ACTIVE_GUIDE_EPSILON = 0.75;
/** Portion of the frame dimension used for each outside fade half. */
const GUIDE_FADE_RATIO = 0.3;

interface FadeStop {
  position: number;
  opacity: number;
}

/** Clamp a number to the normalized alpha range. */
function clampOpacity(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** Resolve the continuous alpha at one coordinate around the frame boundary. */
function fadeOpacityAt(value: number, start: number, end: number, fadeDistance: number): number {
  const outside = value < start ? start - value : value > end ? value - end : 0;
  if (outside <= fadeDistance) {
    return 1;
  }
  return clampOpacity(2 - outside / fadeDistance);
}

/** Build the exact piecewise-linear stops for one pixel-continuous axis fade. */
function axisFadeStops(length: number, start: number, end: number): FadeStop[] {
  const safeLength = Math.max(1, Number(length) || 0);
  const safeStart = Math.min(start, end);
  const safeEnd = Math.max(start, end);
  const fadeDistance = Math.max(1, (safeEnd - safeStart) * GUIDE_FADE_RATIO);
  const points = [
    0,
    safeStart - fadeDistance * 2,
    safeStart - fadeDistance,
    safeStart,
    safeEnd,
    safeEnd + fadeDistance,
    safeEnd + fadeDistance * 2,
    safeLength,
  ]
    .map((point) => Math.min(safeLength, Math.max(0, point)))
    .sort((left, right) => left - right);
  const unique = points.filter((point, index) => index === 0 || point !== points[index - 1]);
  return unique.map((position) => ({
    position,
    opacity: fadeOpacityAt(position, safeStart, safeEnd, fadeDistance),
  }));
}

/** True when a stage position touches either draft anchor on one dimension. */
function nearAnchor(
  position: number,
  points: ({ x: number; y: number } | null)[],
  axis: "x" | "y",
) {
  return points.some(
    (point) =>
      point !== null &&
      Math.abs((axis === "x" ? point.x : point.y) - position) <= ACTIVE_GUIDE_EPSILON,
  );
}

/** Keep only the ruler labels that clear the previous label by the minimum gap. */
function visibleRulerLabels(ticks: readonly SamplingRulerTick[]): SamplingRulerTick[] {
  const labels: SamplingRulerTick[] = [];
  let lastLabelY = Number.NEGATIVE_INFINITY;
  for (const tick of ticks) {
    if (tick.y - lastLabelY < RULER_LABEL_GAP) {
      continue;
    }
    labels.push(tick);
    lastLabelY = tick.y;
  }
  return labels;
}

/** Workspace sampler guides, anchors, and drag path. */
export function SamplingGuideLayer({
  projection,
  viewport,
  axis,
  geometry,
  start,
  end,
  startPoint,
  endPoint,
  showGuides,
  showAnchors,
  cursor,
  guideOpacity,
}: SamplingGuideLayerProps) {
  const opacity = Math.min(1, Math.max(0, guideOpacity));
  const maskPrefix = `sampling-${useId().replaceAll(":", "")}`;
  const anchorPoints = [startPoint, endPoint];
  const rotationValue =
    end?.axis === "rotation" ? end.scalar : start?.axis === "rotation" ? start.scalar : null;
  const rotationRadians = ((rotationValue ?? projection.lineRotation) * Math.PI) / 180;
  const handleX = projection.lineX + Math.cos(rotationRadians) * ROTATION_RAY_LENGTH;
  const handleY = projection.lineY + Math.sin(rotationRadians) * ROTATION_RAY_LENGTH;
  const rulerLabels = geometry.ruler ? visibleRulerLabels(geometry.ruler.ticks) : [];
  const verticalFade = axisFadeStops(projection.stageWidth, viewport.left, viewport.right);
  const horizontalFade = axisFadeStops(projection.stageHeight, viewport.top, viewport.bottom);
  const horizontalFadeDistance = Math.max(1, viewport.height * GUIDE_FADE_RATIO);
  const verticalFadeDistance = Math.max(1, viewport.width * GUIDE_FADE_RATIO);
  const cursorRadius = cursor
    ? Math.max(1, Math.min(viewport.width, viewport.height) * GUIDE_FADE_RATIO)
    : 0;

  return (
    <svg
      className="sampling-svg"
      width={projection.stageWidth}
      height={projection.stageHeight}
      aria-hidden="true"
    >
      <defs>
        <linearGradient
          id={`${maskPrefix}-x-gradient`}
          gradientUnits="userSpaceOnUse"
          x1="0"
          y1="0"
          x2={projection.stageWidth}
          y2="0"
        >
          {verticalFade.map((stop) => (
            <stop
              key={`x-${stop.position}`}
              offset={stop.position / Math.max(1, projection.stageWidth)}
              stopColor="white"
              stopOpacity={stop.opacity}
            />
          ))}
        </linearGradient>
        <linearGradient
          id={`${maskPrefix}-y-gradient`}
          gradientUnits="userSpaceOnUse"
          x1="0"
          y1="0"
          x2="0"
          y2={projection.stageHeight}
        >
          {horizontalFade.map((stop) => (
            <stop
              key={`y-${stop.position}`}
              offset={stop.position / Math.max(1, projection.stageHeight)}
              stopColor="white"
              stopOpacity={stop.opacity}
            />
          ))}
        </linearGradient>
        <mask
          id={`${maskPrefix}-x-mask`}
          maskUnits="userSpaceOnUse"
          x="0"
          y="0"
          width={projection.stageWidth}
          height={projection.stageHeight}
        >
          <rect
            width={projection.stageWidth}
            height={projection.stageHeight}
            fill={`url(#${maskPrefix}-x-gradient)`}
          />
        </mask>
        <mask
          id={`${maskPrefix}-y-mask`}
          maskUnits="userSpaceOnUse"
          x="0"
          y="0"
          width={projection.stageWidth}
          height={projection.stageHeight}
        >
          <rect
            width={projection.stageWidth}
            height={projection.stageHeight}
            fill={`url(#${maskPrefix}-y-gradient)`}
          />
        </mask>
        {cursor && (
          <>
            <radialGradient
              id={`${maskPrefix}-cursor-gradient`}
              gradientUnits="userSpaceOnUse"
              cx={cursor.x}
              cy={cursor.y}
              r={cursorRadius}
            >
              <stop offset="0" stopColor="white" stopOpacity="1" />
              <stop offset="1" stopColor="white" stopOpacity="0" />
            </radialGradient>
            <mask
              id={`${maskPrefix}-cursor-mask`}
              maskUnits="userSpaceOnUse"
              x="0"
              y="0"
              width={projection.stageWidth}
              height={projection.stageHeight}
            >
              <rect width={projection.stageWidth} height={projection.stageHeight} fill="black" />
              <circle
                cx={cursor.x}
                cy={cursor.y}
                r={cursorRadius}
                fill={`url(#${maskPrefix}-cursor-gradient)`}
              />
              <rect
                x={viewport.left - verticalFadeDistance * 2}
                y={viewport.top - horizontalFadeDistance * 2}
                width={viewport.width + verticalFadeDistance * 4}
                height={viewport.height + horizontalFadeDistance * 4}
                fill="black"
              />
            </mask>
          </>
        )}
      </defs>

      <g opacity={opacity} mask={`url(#${maskPrefix}-x-mask)`}>
        <g mask={`url(#${maskPrefix}-y-mask)`}>
          {showGuides &&
            geometry.vertical.map((line) => (
              <line
                key={`v-${line.key}`}
                className={`sampling-guide-line${line.major ? " is-major" : ""}`}
                data-active={nearAnchor(line.position, anchorPoints, "x") ? "true" : undefined}
                x1={line.position}
                y1="0"
                x2={line.position}
                y2={projection.stageHeight}
              />
            ))}
          {showGuides &&
            geometry.horizontal.map((line) => (
              <line
                key={`h-${line.key}`}
                className={`sampling-guide-line${line.major ? " is-major" : ""}`}
                data-active={nearAnchor(line.position, anchorPoints, "y") ? "true" : undefined}
                x1="0"
                y1={line.position}
                x2={projection.stageWidth}
                y2={line.position}
              />
            ))}

          {showGuides && geometry.ruler && (
            <>
              <rect
                className="sampling-ruler-band"
                x={geometry.ruler.bandLeft}
                y={viewport.top}
                width={geometry.ruler.bandWidth}
                height={viewport.height}
              />
              <line
                className="sampling-ruler-spine"
                style={{ opacity: 0.8 }}
                x1={geometry.ruler.x}
                y1={viewport.top}
                x2={geometry.ruler.x}
                y2={viewport.bottom}
              />
              {geometry.ruler.ticks.map((tick) => {
                const active = nearAnchor(tick.y, anchorPoints, "y");
                return (
                  <line
                    key={`tick-${tick.value}`}
                    className={`sampling-ruler-tick${tick.major ? " is-major" : ""}`}
                    data-active={active ? "true" : undefined}
                    x1={geometry.ruler ? geometry.ruler.x - (tick.major ? 8 : 4) : 0}
                    y1={tick.y}
                    x2={geometry.ruler ? geometry.ruler.x + (tick.major ? 8 : 4) : 0}
                    y2={tick.y}
                    style={{ opacity: active ? 1 : tick.major ? 0.7 : 0.42 }}
                  />
                );
              })}
              {rulerLabels.map((tick) => {
                const labelY = Math.min(viewport.bottom - 6, Math.max(viewport.top + 6, tick.y));
                return (
                  <text
                    key={`label-${tick.value}`}
                    className="sampling-ruler-label"
                    data-active={nearAnchor(tick.y, anchorPoints, "y") ? "true" : undefined}
                    x={geometry.ruler ? geometry.ruler.x - 12 : 0}
                    y={labelY}
                    textAnchor="end"
                    dominantBaseline="middle"
                  >
                    {tick.label}
                  </text>
                );
              })}
            </>
          )}

          {axis === "rotation" && showGuides && (
            <>
              <line
                className="sampling-rotation-ray"
                style={{ opacity: 0.72 }}
                x1={projection.lineX}
                y1={projection.lineY}
                x2={handleX}
                y2={handleY}
              />
              <circle
                className="sampling-rotation-hub"
                cx={projection.lineX}
                cy={projection.lineY}
                r={5}
              />
            </>
          )}

          {showAnchors && startPoint && endPoint && (
            <line
              className="sampling-path-line"
              style={{ opacity: 0.8 }}
              x1={startPoint.x}
              y1={startPoint.y}
              x2={endPoint.x}
              y2={endPoint.y}
            />
          )}

          {showAnchors && startPoint && anchorGuides(axis, startPoint, viewport, "start")}
          {showAnchors && endPoint && anchorGuides(axis, endPoint, viewport, "end")}

          {showAnchors && startPoint && (
            <circle
              className="sampling-anchor-point"
              data-anchor="start"
              cx={startPoint.x}
              cy={startPoint.y}
              r={6}
            />
          )}
          {showAnchors && endPoint && (
            <circle
              className="sampling-anchor-point"
              data-anchor="end"
              cx={endPoint.x}
              cy={endPoint.y}
              r={6}
            />
          )}
        </g>
      </g>

      {cursor && showGuides && (
        <g opacity={opacity} mask={`url(#${maskPrefix}-cursor-mask)`}>
          {geometry.vertical.map((line) => (
            <line
              key={`cursor-v-${line.key}`}
              className={`sampling-guide-line${line.major ? " is-major" : ""}`}
              data-active={nearAnchor(line.position, anchorPoints, "x") ? "true" : undefined}
              x1={line.position}
              y1="0"
              x2={line.position}
              y2={projection.stageHeight}
            />
          ))}
          {geometry.horizontal.map((line) => (
            <line
              key={`cursor-h-${line.key}`}
              className={`sampling-guide-line${line.major ? " is-major" : ""}`}
              data-active={nearAnchor(line.position, anchorPoints, "y") ? "true" : undefined}
              x1="0"
              y1={line.position}
              x2={projection.stageWidth}
              y2={line.position}
            />
          ))}
        </g>
      )}
    </svg>
  );
}

/** The crosshair or scalar line that marks one anchor. */
function anchorGuides(
  axis: SamplingAxis,
  point: { x: number; y: number },
  viewport: SamplingViewport,
  anchor: "start" | "end",
) {
  if (isScalarAxis(axis)) {
    return (
      <line
        className="sampling-anchor-guide"
        data-anchor={anchor}
        x1={viewport.left}
        y1={point.y}
        x2={viewport.right}
        y2={point.y}
      />
    );
  }
  return (
    <g className="sampling-anchor-guide" data-anchor={anchor}>
      <line x1={point.x} y1={viewport.top} x2={point.x} y2={viewport.bottom} />
      <line x1={viewport.left} y1={point.y} x2={viewport.right} y2={point.y} />
    </g>
  );
}
