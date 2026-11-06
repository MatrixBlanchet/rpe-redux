/**
 * Turns mouse trail samples into a ribbon path with tapering width. The sample
 * model owns timing and pruning; this module only computes path text that a
 * canvas `Path2D` can consume.
 */
import type { MouseTrailSample } from "./mouseTrailModel.ts";

/** Path text for one ribbon and the opacity the head implies. */
export interface MouseTrailPathRender {
  readonly d: string;
  readonly opacity: string;
  readonly pointCount: number;
}

interface TrailOffset {
  readonly leftX: number;
  readonly leftY: number;
  readonly rightX: number;
  readonly rightY: number;
}

/** Formats a coordinate with at most three decimals, avoiding trailing zeros. */
function format(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(3);
}

/** Cross-section offset for one sample, using the direction between its neighbours. */
function offsetAt(samples: readonly MouseTrailSample[], index: number): TrailOffset {
  const sample = samples[index];
  const previous = samples[Math.max(0, index - 1)] ?? sample;
  const next = samples[Math.min(samples.length - 1, index + 1)] ?? sample;
  const dx = next.x - previous.x;
  const dy = next.y - previous.y;
  const length = Math.hypot(dx, dy);
  const normalX = length > 0 ? -dy / length : 0;
  const normalY = length > 0 ? dx / length : -1;
  const radius = sample.width / 2;
  return {
    leftX: sample.x + normalX * radius,
    leftY: sample.y + normalY * radius,
    rightX: sample.x - normalX * radius,
    rightY: sample.y - normalY * radius,
  };
}

/**
 * Builds one closed ribbon for the whole trail. Every sample contributes one
 * cross-section to this path, so adjacent samples share one continuous boundary.
 */
export function createMouseTrailPathRender(
  samples: readonly MouseTrailSample[],
): MouseTrailPathRender {
  if (samples.length === 0) {
    return { d: "", opacity: "0", pointCount: 0 };
  }

  const offsets = samples.map((_, index) => offsetAt(samples, index));
  const first = offsets[0];
  const head = samples[samples.length - 1];
  const headOffset = offsets[offsets.length - 1];
  const path: string[] = [`M ${format(first.leftX)} ${format(first.leftY)}`];
  for (let index = 1; index < offsets.length; index += 1) {
    path.push(`L ${format(offsets[index].leftX)} ${format(offsets[index].leftY)}`);
  }

  const headRadius = head.width / 2;
  path.push(
    `A ${format(headRadius)} ${format(headRadius)} 0 0 0 ${format(headOffset.rightX)} ${format(headOffset.rightY)}`,
  );
  for (let index = offsets.length - 2; index >= 0; index -= 1) {
    path.push(`L ${format(offsets[index].rightX)} ${format(offsets[index].rightY)}`);
  }
  path.push("Z");

  return {
    d: path.join(" "),
    opacity: String(head.alpha),
    pointCount: samples.length,
  };
}
