/**
 * Which notes are inside a hit animation right now, and what each one shows.
 *
 * The preview plays an effect for every note the playhead has just crossed, so
 * this looks the current second up in an interval index, keeps the notes whose
 * animation window is open, and answers with the frame each one is on. The
 * reading half of the effect; `render/` draws what it returns.
 */
import { upperBound } from "../../../../../../core/utils/search.ts";
import type { IntervalIndex } from "../../../../../../core/utils/intervalIndex.ts";
import type { NoteEntry } from "../../../../../../core/global/chart/runtime/scene.ts";

/** Seconds between repeated hold-hit pulses. */
export const HOLD_HIT_INTERVAL = 20 / 120;

/** Frames at the tail of a hit animation that fade the skin frame and pull it inward. */
export const HIT_FADE_FRAMES = 16;
/** Fraction of the sprite size the tail collapse removes (0.5 keeps half). */
export const HIT_COLLAPSE = 0.5;

/** How far the skin frame is faded and shrunk at one animation frame. */
export interface HitEffectPose {
  /** Size multiplier applied to the skin frame. */
  scale: number;
  /** Opacity multiplier applied to the skin frame. */
  alpha: number;
}

/**
 * Pose of the skin's hit animation: still, then a fading inward collapse.
 *
 * The skin frames already animate the diamond outwards; the last half of the
 * animation is where it has finished expanding, so the preview fades it out
 * while pulling it halfway back in. Earlier frames keep the sprite untouched.
 */
export function hitEffectPose(frame: number, frameCount: number): HitEffectPose {
  const count = Math.max(0, Math.floor(frameCount));
  const tail = Math.min(HIT_FADE_FRAMES, count);
  const first = count - tail + 1;
  if (tail === 0 || frame < first) {
    return { scale: 1, alpha: 1 };
  }
  const progress = Math.min(1, Math.max(0, (frame - first + 1) / tail));
  return { scale: 1 - HIT_COLLAPSE * progress, alpha: 1 - progress };
}

/** The slice of `LineRuntime` the hit feed reads. */
export interface HitRuntime {
  hitTimes: NoteEntry[];
  holdIndex: IntervalIndex<NoteEntry>;
}

/** One rendered hit: the note entry, its time in seconds, and its particle seed. */
export interface Hit {
  entry: NoteEntry;
  time: number;
  seed: number;
}

/** Fill a caller-owned hit buffer for a frame without allocating a hit array. */
export function recentHitsInto(
  runtime: HitRuntime,
  seconds: number,
  since: number,
  hits: Hit[],
  lifetime = 2 / 3,
): number {
  hits.length = 0;
  const first = upperBound(
    runtime.hitTimes,
    Math.max(seconds - lifetime, since),
    (entry) => entry.start,
  );
  const last = upperBound(runtime.hitTimes, seconds, (entry) => entry.start);
  for (let index = first; index < last; index++) {
    const entry = runtime.hitTimes[index];
    if (entry.note.type !== 2 && !entry.note.isFake) {
      const slot = hits.length;
      const hit = hits[slot] ?? (hits[slot] = { entry, time: 0, seed: 0 });
      hit.entry = entry;
      hit.time = entry.start;
      hit.seed = index;
      hits.length = slot + 1;
    }
  }
  for (const { item: entry, index } of runtime.holdIndex.query(seconds - lifetime, seconds)) {
    if (entry.note.isFake) {
      continue;
    }
    const firstPulse = Math.max(
      0,
      Math.floor((Math.max(seconds - lifetime, since) - entry.start) / HOLD_HIT_INTERVAL) + 1,
    );
    const lastPulse = Math.min(
      Math.floor((seconds - entry.start) / HOLD_HIT_INTERVAL),
      Math.ceil((entry.end - entry.start) / HOLD_HIT_INTERVAL) - 1,
    );
    for (let pulse = firstPulse; pulse <= lastPulse; pulse++) {
      const slot = hits.length;
      const hit = hits[slot] ?? (hits[slot] = { entry, time: 0, seed: 0 });
      hit.entry = entry;
      hit.time = entry.start + pulse * HOLD_HIT_INTERVAL;
      hit.seed = index * 65537 + pulse;
      hits.length = slot + 1;
    }
  }
  return hits.length;
}

/** Allocates a hit buffer for the hits inside `lifetime`; see `recentHitsInto`. */
export function recentHits(
  runtime: HitRuntime,
  seconds: number,
  since: number,
  lifetime = 2 / 3,
): Hit[] {
  const hits: Hit[] = [];
  recentHitsInto(runtime, seconds, since, hits, lifetime);
  return hits;
}
