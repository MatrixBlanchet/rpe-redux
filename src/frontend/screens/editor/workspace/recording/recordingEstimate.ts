/**
 * Output-size estimate and the bitrate rule shared by the recording inspector
 * and the encoder handoff.
 *
 * The inspector accepts `-1` for the video bitrate. Resolving that request from
 * the output geometry here keeps the size a person reads and the target sent to
 * FFmpeg on the same number. Image-sequence and audio-only formats do not use
 * that target, so each family has its own conservative estimate.
 */
import type { RecordingFormat } from "../../../../../core/platform/desktop/recording.ts";

/** Bitrate-field sentinel that derives a target from width, height and fps. */
export const AUTO_VIDEO_BITRATE = -1;

/** AAC track target used by the bundled encoder command, in bits per second. */
export const RECORDING_AUDIO_BPS = 128_000;

/** Opus track target used by the WebM command, in bits per second. */
const RECORDING_OPUS_BPS = 160_000;

/** Target bits per pixel per frame: 1080p60 lands near 12 Mbps. */
const AUTO_BITS_PER_PIXEL = 0.1;

/** Container and packetisation overhead applied to the payload estimate. */
const CONTAINER_OVERHEAD = 1.02;

/** Output geometry, frame rate, source interval, and optional format for a size estimate. */
export interface RecordingEstimateOptions {
  readonly width: number;
  readonly height: number;
  readonly fps: number;
  /** Manual Mbps target, or `AUTO_VIDEO_BITRATE`. */
  readonly videoBitrate: number;
  /** Source interval duration; the output is shortened by `speed`. */
  readonly seconds: number;
  /** Defaults to MP4 so existing callers keep their estimate. */
  readonly format?: RecordingFormat;
  /** Song seconds advanced per output frame; defaults to 1. */
  readonly speed?: number;
}

/** Estimated bytes and the output duration after speed scaling. */
export interface RecordingEstimate {
  readonly bytes: number;
  readonly outputSeconds: number;
}

/**
 * Resolve the manual target or derive one from the output geometry.
 *
 * Auto targets stay within the encoder's accepted 1–100 Mbps range and use
 * whole megabits, because the native command receives an integer. Invalid
 * manual values return `NaN` so the inspector shows an unknown estimate rather
 * than a number the export would reject.
 */
export function resolveVideoBitrateMbps(
  width: number,
  height: number,
  fps: number,
  requested: number,
): number {
  if (requested !== AUTO_VIDEO_BITRATE) {
    return Number.isInteger(requested) && requested >= 1 && requested <= 100 ? requested : NaN;
  }
  if (!(width >= 2) || !(height >= 2) || !(fps >= 1)) {
    return NaN;
  }
  const target = (width * height * fps * AUTO_BITS_PER_PIXEL) / 1_000_000;
  return Math.min(100, Math.max(1, Math.round(target)));
}

/** Bytes for an audio-only track at a fixed target bitrate. */
function audioOnlyBytes(bitsPerSecond: number, seconds: number): number {
  return Math.round(((bitsPerSecond * seconds) / 8) * CONTAINER_OVERHEAD);
}

/**
 * Estimated bytes and output duration for the source interval.
 *
 * MP4/MKV/MOV use the video target plus AAC. WebM uses the same video target
 * plus Opus. GIF/APNG/WebP ignore the bitrate field and are estimated from the
 * pixel rate, deliberately erring high because palette and lossless animation
 * sizes vary widely with content. Every rate-based term uses the shortened
 * output duration, because the same frame rate covers fewer frames at speed.
 */
export function estimateRecording(options: RecordingEstimateOptions): RecordingEstimate {
  const { seconds } = options;
  const speed = options.speed ?? 1;
  if (
    !Number.isFinite(seconds) ||
    seconds <= 0 ||
    !Number.isFinite(speed) ||
    speed < 0.5 ||
    speed > 4
  ) {
    return { bytes: 0, outputSeconds: 0 };
  }
  const outputSeconds = seconds / speed;
  return { bytes: estimateBytes(options, outputSeconds), outputSeconds };
}

/** Estimated output bytes for the source interval. */
export function estimateRecordingBytes(options: RecordingEstimateOptions): number {
  return estimateRecording(options).bytes;
}

/** Apply the format family's rate rule to the shortened output duration. */
function estimateBytes(options: RecordingEstimateOptions, outputSeconds: number): number {
  switch (options.format ?? "mp4") {
    case "mp3":
      return audioOnlyBytes(192_000, outputSeconds);
    case "flac":
      return audioOnlyBytes(900_000, outputSeconds);
    case "wav":
      return audioOnlyBytes(1_536_000, outputSeconds);
    case "ogg":
      return audioOnlyBytes(160_000, outputSeconds);
    case "gif":
    case "apng":
    case "webp": {
      if (!(options.width >= 2) || !(options.height >= 2) || !(options.fps >= 1)) {
        return 0;
      }
      const bitsPerPixel = options.format === "apng" ? 0.5 : options.format === "gif" ? 0.25 : 0.15;
      return Math.round(
        (options.width * options.height * options.fps * bitsPerPixel * outputSeconds) / 8,
      );
    }
    default: {
      const mbps = resolveVideoBitrateMbps(
        options.width,
        options.height,
        options.fps,
        options.videoBitrate,
      );
      if (!Number.isFinite(mbps)) {
        return 0;
      }
      const audioBps = options.format === "webm" ? RECORDING_OPUS_BPS : RECORDING_AUDIO_BPS;
      const bits = (mbps * 1_000_000 + audioBps) * outputSeconds;
      return Math.round((bits / 8) * CONTAINER_OVERHEAD);
    }
  }
}
