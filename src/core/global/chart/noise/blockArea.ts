/**
 * Noise-area (`blockAreaList`) data.
 *
 * Positions are RPE pixels and times are beats. Each area keeps one event track
 * per move/rotate/scale axis plus its active intervals. The preview samples this
 * model directly, and chart serialization preserves the stored objects as they
 * are. Editor noise lines project a unit square whose scale tracks hold the
 * square's width and height, so there the tracks act as size X/Y.
 */
import type { JudgeLineEvent } from "../chart.ts";
import type { Beat } from "../timing/beat.ts";

export interface BlockAreaPoint {
  x: number;
  y: number;
}

export interface BlockAreaEvent extends JudgeLineEvent {
  anchor?: BlockAreaPoint;
  transformStart?: number;
  transformEnd?: number;
  transformStep?: boolean;
}

export interface BlockAreaInterval {
  startTime: Beat;
  endTime: Beat;
  /** Fade-in lead before `startTime`, in seconds. */
  readyFlash?: number | boolean;
}

export interface BlockArea {
  Name?: string;
  /** Optional theme colour, retained in its original JSON representation. */
  color?: unknown;
  bottomLeft: BlockAreaPoint;
  topRight: BlockAreaPoint;
  appearTime: Beat;
  disappearTime: Beat;
  activeIntervals: BlockAreaInterval[];
  isInvert?: boolean;
  moveXEvents: BlockAreaEvent[];
  moveYEvents: BlockAreaEvent[];
  rotateEvents: BlockAreaEvent[];
  scaleXEvents: BlockAreaEvent[];
  scaleYEvents: BlockAreaEvent[];
}

/** Axis-aligned bounds and ordered corners of one area. */
export interface BlockAreaBounds {
  readonly left: number;
  readonly right: number;
  readonly bottom: number;
  readonly top: number;
  /** Area centre, computed from the original corner pair order. */
  readonly centerX: number;
  readonly centerY: number;
  /** Bottom-left, bottom-right, top-right, top-left. */
  readonly corners: readonly BlockAreaPoint[];
}

/**
 * Resolve the area rectangle once.
 *
 * The centre keeps the original `(bottomLeft + topRight) / 2` expression rather
 * than deriving it from the normalized min/max edges, so mirrored rectangles
 * retain the same origin they had before the bounds were factored out.
 */
export function blockAreaBounds(area: BlockArea): BlockAreaBounds {
  const left = Math.min(area.bottomLeft.x, area.topRight.x);
  const right = Math.max(area.bottomLeft.x, area.topRight.x);
  const bottom = Math.min(area.bottomLeft.y, area.topRight.y);
  const top = Math.max(area.bottomLeft.y, area.topRight.y);
  return {
    left,
    right,
    bottom,
    top,
    centerX: (area.bottomLeft.x + area.topRight.x) / 2,
    centerY: (area.bottomLeft.y + area.topRight.y) / 2,
    corners: [
      { x: left, y: bottom },
      { x: right, y: bottom },
      { x: right, y: top },
      { x: left, y: top },
    ],
  };
}
