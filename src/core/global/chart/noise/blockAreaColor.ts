/** Parses the optional block-area theme colour. */
import { isRecord } from "../../../utils/guards.ts";

/**
 * Accepts #RRGGBB, an RGB array, or an object with r/g/b. Numeric components are
 * divided by 255 when any channel exceeds 1, then clamped. Returns null for a
 * missing or malformed value so callers can use the default.
 */
export function blockAreaColor(value: unknown): [number, number, number] | null {
  let components: unknown[];
  if (typeof value === "string") {
    if (!/^#[\da-f]{6}$/i.test(value)) {
      return null;
    }
    components = [1, 3, 5].map((index) => parseInt(value.slice(index, index + 2), 16) / 255);
  } else if (Array.isArray(value) && value.length >= 3) {
    components = value.slice(0, 3);
  } else if (isRecord(value)) {
    components = [value.r, value.g, value.b];
  } else {
    return null;
  }
  if (
    !components.every((component) => typeof component === "number" && Number.isFinite(component))
  ) {
    return null;
  }
  const channels = components as number[];
  const divisor = channels.some((channel) => channel > 1) ? 255 : 1;
  return channels.map((channel) => Math.max(0, Math.min(1, channel / divisor))) as [
    number,
    number,
    number,
  ];
}
