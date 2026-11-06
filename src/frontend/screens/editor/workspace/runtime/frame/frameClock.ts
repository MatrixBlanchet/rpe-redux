/**
 * Advances the editor's media and interaction clocks on every display callback,
 * even when the frame is not painted. Timing policy stays in the injected audio,
 * edit clock, and tempo owners.
 */
import type { AudioTransport } from "../../../../../../core/media/audio.ts";
import type { HitSounds } from "../../../../../../core/media/hitsounds.ts";

import type { EditorEditClock } from "../../../../../../core/edit/state/editClock.ts";

import type { EditorSession } from "../../../../../../core/edit/session/session.ts";
import type { TempoMap } from "../../../../../../core/global/chart/timing/tempo.ts";
import type { Timeline } from "../../timeline/surface/timeline.ts";

import type { EditorFrameState, FrameVisibility } from "./frame.ts";
/** Clocks and callbacks advanced on every display callback. */
export interface FrameClockOptions {
  audio: Pick<AudioTransport, "update" | "playing" | "time" | "duration" | "pause">;
  timeline: Pick<Timeline, "autoScroll">;
  lineSwitcher: { draw(timestamp: number): void };
  editClock: Pick<EditorEditClock, "advance">;
  hitSounds: Pick<HitSounds, "tick">;
  session(): EditorSession;
  tempo(): TempoMap;
  chartSeconds(): number;
  invalidate(): void;
}
/** Advance media/gesture clocks on every callback, even when painting is skipped. */
export function createFrameClock(options: FrameClockOptions, visibility: FrameVisibility) {
  const runtime = options;
  return {
    /** Advances audio, scrolling, overlays, FPS sampling, and edit time. */
    advance(
      timestamp: number,
      state: Pick<
        EditorFrameState,
        "lastTick" | "frameSampleStart" | "measuredFps" | "frameSampleCount"
      >,
      overlayDue: boolean,
    ): void {
      const elapsed = state.lastTick ? (timestamp - state.lastTick) / 1000 : 0;
      state.lastTick = timestamp;
      runtime.audio.update();
      if (overlayDue && !visibility.atHome() && !visibility.documentHidden()) {
        runtime.lineSwitcher.draw(timestamp);
      }
      if (!visibility.atHome()) {
        runtime.timeline.autoScroll(elapsed);
      }
      if (timestamp - state.frameSampleStart >= 500) {
        state.measuredFps = (state.frameSampleCount * 1000) / (timestamp - state.frameSampleStart);
        state.frameSampleStart = timestamp;
        state.frameSampleCount = 0;
      }
      runtime.editClock.advance(
        timestamp,
        visibility.hasDocument() && !visibility.atHome() && !visibility.documentHidden(),
      );
    },
    /** Stops playback at the media end and returns the session and its tempo map. */
    sample() {
      if (runtime.audio.playing && runtime.audio.time >= runtime.audio.duration) {
        runtime.audio.pause();
        runtime.invalidate();
      }
      const session = runtime.session();
      const tempo = runtime.tempo();
      runtime.hitSounds.tick(session.chart, tempo, session.lineIndex);

      return { session, tempo };
    },
    playing: () => options.audio.playing,
    seconds: options.chartSeconds,
  };
}
