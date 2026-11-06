/**
 * Owns the playback handle a plugin sees.
 *
 * Playback belongs to the mounted editor, so every method reads the editor
 * connected at call time. Between one editor's teardown and the next mount,
 * calls return an unavailable result. The implementation and host contract are
 * `core/edit/playback/api.ts`.
 *
 * Playback is a property of the open document, not of the plugin host.
 *
 * Minimal usage (after an editor has mounted):
 * ```js
 * redux.playback.seekBeat(12);
 * redux.playback.setRate(1.25);
 * redux.playback.play();
 * console.log(redux.playback.state().value.chartSeconds);
 * ```
 */
import { getPlaybackApi, type PlaybackApi } from "../edit/playback/api.ts";
import { apiCall, apiCallAsync, availabilityFor, unavailableResult } from "./support.ts";
import type { ApiAvailability, ApiResult } from "./contract.ts";

/** Run one synchronous playback call against the mounted editor. */
function withPlayback<T>(run: (api: PlaybackApi) => T): ApiResult<T> {
  const api = getPlaybackApi();
  return api
    ? apiCall(() => run(api))
    : unavailableResult<T>("No editor playback runtime connected");
}

/** Run one asynchronous playback call against the mounted editor. */
async function withPlaybackAsync<T>(run: (api: PlaybackApi) => Promise<T>): Promise<ApiResult<T>> {
  const api = getPlaybackApi();
  return api
    ? apiCallAsync(() => run(api))
    : unavailableResult<T>("No editor playback runtime connected");
}

/** Transport, rendering, and diagnostics actions exposed to plugins. */
export const playback = Object.freeze({
  /** Report whether a playback runtime is connected. */
  availability(): ApiAvailability {
    return availabilityFor(getPlaybackApi(), "No editor playback runtime connected");
  },
  /** The current transport state. */
  state: (): ApiResult<ReturnType<PlaybackApi["state"]>> => withPlayback((api) => api.state()),
  /** Start playback; requires a loaded chart. */
  play: (): Promise<ApiResult<Awaited<ReturnType<PlaybackApi["play"]>>>> =>
    withPlaybackAsync((api) => api.play()),
  /** Halt the clock and keep the current position. */
  pause: (): ApiResult<ReturnType<PlaybackApi["pause"]>> => withPlayback((api) => api.pause()),
  /** Halt the clock and keep the current position. */
  stop: (): ApiResult<ReturnType<PlaybackApi["stop"]>> => withPlayback((api) => api.stop()),
  /** Seek to the current offset and play from there. */
  replay: (): Promise<ApiResult<Awaited<ReturnType<PlaybackApi["replay"]>>>> =>
    withPlaybackAsync((api) => api.replay()),
  /** Seek to a time in chart or audio seconds; pauses on arrival by default. */
  seek: (...args: Parameters<PlaybackApi["seek"]>): ApiResult<ReturnType<PlaybackApi["seek"]>> =>
    withPlayback((api) => api.seek(...args)),
  /** Seek to a chart beat on the active line. */
  seekBeat: (
    ...args: Parameters<PlaybackApi["seekBeat"]>
  ): ApiResult<ReturnType<PlaybackApi["seekBeat"]>> => withPlayback((api) => api.seekBeat(...args)),
  /** Set the playback rate; the accepted range is (0, 16]. */
  setRate: (rate: number): ApiResult<ReturnType<PlaybackApi["setRate"]>> =>
    withPlayback((api) => api.setRate(rate)),
  /** Evaluate judge lines at a time without drawing. */
  inspect: (
    ...args: Parameters<PlaybackApi["inspect"]>
  ): ApiResult<ReturnType<PlaybackApi["inspect"]>> => withPlayback((api) => api.inspect(...args)),
  /** Render at a time and return the evaluated frame snapshot. */
  renderAt: (seconds: number): ApiResult<ReturnType<PlaybackApi["renderAt"]>> =>
    withPlayback((api) => api.renderAt(seconds)),
  /** Decoded, pending, and failed textures in the renderer. */
  textures: (): ApiResult<ReturnType<PlaybackApi["textures"]>> =>
    withPlayback((api) => api.textures()),
  /** The last rendered frames; empty when the host reports none. */
  frames: (): ApiResult<ReturnType<PlaybackApi["frames"]>> => withPlayback((api) => api.frames()),
  /** Start capturing playback metrics; requires a loaded chart. */
  startMeasurement: (): ApiResult<ReturnType<PlaybackApi["startMeasurement"]>> =>
    withPlayback((api) => api.startMeasurement()),
  /** Stop capturing metrics and return the report. */
  stopMeasurement: (): ApiResult<ReturnType<PlaybackApi["stopMeasurement"]>> =>
    withPlayback((api) => api.stopMeasurement()),
  /** The current metrics report. */
  metrics: (): ApiResult<ReturnType<PlaybackApi["metrics"]>> =>
    withPlayback((api) => api.metrics()),
  /** Stop metrics and clear the scene adapter. */
  resetDiagnostics: (): ApiResult<ReturnType<PlaybackApi["resetDiagnostics"]>> =>
    withPlayback((api) => api.resetDiagnostics()),
});

export type PlaybackHandle = typeof playback;

export type {
  PlaybackClock,
  PlaybackFrame,
  PlaybackFrameLine,
  PlaybackFrameNote,
  PlaybackSeekOptions,
  PlaybackState,
  PlaybackTextureStatus,
} from "../edit/playback/api.ts";
