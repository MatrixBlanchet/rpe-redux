/**
 * Aspect-ratio presets and output dimensions for the render pane.
 *
 * The ratio and the resolution are separate choices: a fixed ratio filters the
 * standard resolution table, and a ratio change picks the closest tier to the
 * current output area. The custom ratio removes the table and leaves the width
 * and height fields free.
 */

/** One selectable render aspect ratio; `custom` frees the width/height fields. */
export type RecordingRatio = "16:9" | "3:2" | "4:3" | "custom";

/** A fixed ratio, which owns a preset resolution table. */
export type FixedRecordingRatio = Exclude<RecordingRatio, "custom">;

/** Output pixel dimensions. */
export interface RecordingDimensions {
  readonly width: number;
  readonly height: number;
}

/** The default ratio and its 1080p tier. */
export const DEFAULT_RECORDING_RATIO: RecordingRatio = "16:9";
export const DEFAULT_RECORDING_RESOLUTION = "1920x1080";

/** Every ratio the render pane offers, in dropdown order. */
export const RECORDING_RATIOS: readonly RecordingRatio[] = Object.freeze([
  "16:9",
  "3:2",
  "4:3",
  "custom",
]);

/** Standard output tiers for each fixed ratio, ascending by height. */
export const RECORDING_RESOLUTIONS: Readonly<Record<FixedRecordingRatio, readonly string[]>> =
  Object.freeze({
    "16:9": Object.freeze(["1280x720", "1920x1080", "2560x1440", "3840x2160"]),
    "3:2": Object.freeze(["1080x720", "1620x1080", "2160x1440", "2880x1920"]),
    "4:3": Object.freeze(["960x720", "1440x1080", "1920x1440", "2880x2160"]),
  });

/** The 1080p tier for a ratio, used as the fallback when no size is known. */
function defaultResolutionFor(ratio: FixedRecordingRatio): string {
  return RECORDING_RESOLUTIONS[ratio][Math.min(1, RECORDING_RESOLUTIONS[ratio].length - 1)];
}

/** Parses a `widthxheight` preset into positive integers, or null. */
export function parseRecordingResolution(value: string): RecordingDimensions | null {
  const match = /^(\d+)x(\d+)$/u.exec(value);
  if (!match) {
    return null;
  }
  const width = Number(match[1]);
  const height = Number(match[2]);
  return width >= 2 && height >= 2 ? { width, height } : null;
}

/** The preset closest to the current output area for a fixed ratio. */
export function closestRecordingResolution(
  ratio: FixedRecordingRatio,
  current: RecordingDimensions,
): string {
  const presets = RECORDING_RESOLUTIONS[ratio];
  if (
    !Number.isFinite(current.width) ||
    !Number.isFinite(current.height) ||
    current.width < 2 ||
    current.height < 2
  ) {
    return defaultResolutionFor(ratio);
  }
  const area = current.width * current.height;
  let best = presets[0];
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const preset of presets) {
    const parsed = parseRecordingResolution(preset);
    if (!parsed) {
      continue;
    }
    const distance = Math.abs(parsed.width * parsed.height - area);
    if (distance < bestDistance) {
      best = preset;
      bestDistance = distance;
    }
  }
  return best;
}

/**
 * Output pixels for the current controls.
 *
 * A fixed ratio always returns a table member; a stale preset falls back to the
 * ratio's 1080p tier. The custom ratio trusts the two text fields so the user
 * can enter a size that the job validation then checks.
 */
export function recordingDimensions(
  ratio: RecordingRatio,
  resolution: string,
  customWidth: string,
  customHeight: string,
): RecordingDimensions {
  if (ratio === "custom") {
    return { width: Number(customWidth), height: Number(customHeight) };
  }
  const presets = RECORDING_RESOLUTIONS[ratio];
  const selected = presets.includes(resolution) ? resolution : defaultResolutionFor(ratio);
  return parseRecordingResolution(selected) ?? { width: 0, height: 0 };
}
