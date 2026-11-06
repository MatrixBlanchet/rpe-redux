/** Mixes bounded sections of music and hit sounds on the recording's song clock. */
import {
  hitTimeline,
  SoundTriggerPolicy,
  type HitSounds,
} from "../../../../../core/media/hitsounds.ts";
import type { Chart } from "../../../../../core/global/chart/chart.ts";
import type { TempoMap } from "../../../../../core/global/chart/timing/tempo.ts";
import type { RecordingTimeline } from "./recordingTimeline.ts";

/** Native encoder input is stereo float PCM at this rate. */
export const RECORDING_SAMPLE_RATE = 48_000;
const CHUNK_SAMPLES = 10 * RECORDING_SAMPLE_RATE;

/**
 * Exact source sample count covered by the output frames, including a partial
 * final sample. The native encoder compresses this source span with `atempo`.
 */
export function recordingSampleCount(timeline: RecordingTimeline): number {
  return Math.ceil(
    (timeline.frameCount * timeline.options.speed * RECORDING_SAMPLE_RATE) / timeline.options.fps,
  );
}

/**
 * Render bounded stereo chunks. A sound that crosses a chunk or selection
 * boundary is resumed at the matching source offset, without touching playback.
 */
export async function captureRecordingAudio(
  timeline: RecordingTimeline,
  chart: Chart,
  tempo: TempoMap,
  music: AudioBuffer,
  hits: HitSounds,
  signal: AbortSignal,
  musicVolume = hits.transport.volume,
  effectsVolume = 1,
): Promise<RecordingAudio> {
  const totalSamples = recordingSampleCount(timeline);
  const end = timeline.options.start + totalSamples / RECORDING_SAMPLE_RATE;
  const entries = hitTimeline(chart, tempo, hits.offsets).filter((entry) => entry.time < end);
  const generation = hits.generation;
  const policy = new SoundTriggerPolicy(hits.soundPolicy.enabled, hits.soundPolicy.limit);
  const volumes = { ...hits.soundVolumes };
  const names = [...new Set(entries.map((entry) => entry.sound))];
  const loaded = await Promise.all(names.map((name) => hits.loadSound(name)));
  signal.throwIfAborted();
  if (generation !== hits.generation) {
    throw new Error("recording_resources_changed");
  }
  const sounds = new Map(names.map((name, index) => [name, loaded[index]]));
  const triggers = entries.flatMap((entry) => {
    const sound = sounds.get(entry.sound);
    if (!sound || !policy.accept(entry.sound, entry.time)) {
      return [];
    }
    const kind =
      entry.sound === "tap" || entry.sound === "drag" || entry.sound === "flick"
        ? entry.sound
        : "custom";
    return [{ time: entry.time, sound, volume: volumes[kind] * effectsVolume }];
  });
  return { music, musicVolume, triggers };
}

/** Captured sound buffers and volumes are independent of later document changes. */
export interface RecordingAudio {
  music: AudioBuffer;
  musicVolume: number;
  triggers: { time: number; sound: AudioBuffer; volume: number }[];
}

/** Mix the captured sound into bounded chunks. */
export async function* mixRecordingAudio(
  timeline: RecordingTimeline,
  snapshot: RecordingAudio,
  signal: AbortSignal,
): AsyncGenerator<AudioBuffer> {
  const { music, musicVolume, triggers } = snapshot;
  const totalSamples = recordingSampleCount(timeline);
  for (let offset = 0; offset < totalSamples; offset += CHUNK_SAMPLES) {
    signal.throwIfAborted();
    const length = Math.min(CHUNK_SAMPLES, totalSamples - offset);
    const chunkStart = timeline.options.start + offset / RECORDING_SAMPLE_RATE;
    const chunkEnd = chunkStart + length / RECORDING_SAMPLE_RATE;
    const context = new OfflineAudioContext(2, length, RECORDING_SAMPLE_RATE);
    if (chunkStart < music.duration) {
      const source = context.createBufferSource();
      const gain = context.createGain();
      source.buffer = music;
      gain.gain.value = musicVolume;
      source.connect(gain).connect(context.destination);
      source.start(0, chunkStart);
    }
    for (const trigger of triggers) {
      if (trigger.time >= chunkEnd) {
        break;
      }
      if (trigger.time + trigger.sound.duration <= chunkStart) {
        continue;
      }
      const source = context.createBufferSource();
      const gain = context.createGain();
      source.buffer = trigger.sound;
      gain.gain.value = trigger.volume;
      source.connect(gain).connect(context.destination);
      const relative = trigger.time - chunkStart;
      source.start(Math.max(0, relative), Math.max(0, -relative));
    }
    const mixed = await context.startRendering();
    signal.throwIfAborted();
    yield mixed;
  }
}
