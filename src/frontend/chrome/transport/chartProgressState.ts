/**
 * Owns the progress readout's snapshot cell, the writes the runtime and views
 * make to it, and the registry surfaces its context menu draws.
 */
import type { ContextMenuSurface } from "../../../core/shell/registries/contextMenu.ts";
import type { ContextMenuTarget } from "../../../core/shell/registries/toolbar.ts";
import { createLateBound } from "../../../core/utils/lateBound.ts";
import { createValue } from "../../../core/state/values.ts";
import { t } from "../../../i18n/index.ts";
import type {
  EditorHostProgressSnapshot,
  EditorHostProgressState,
} from "../../contracts/editorHost.ts";

/** The transport readouts the progress card prints. */
export type ProgressSnapshot = EditorHostProgressSnapshot;

/** Progress readouts together with the seek binding the runtime installs. */
export type ProgressState = EditorHostProgressState;

/** Playback progress publishes at 30 Hz so the card's React subtree stays cheap. */
export const PROGRESS_REFRESH_HZ = 30;

/**
 * Whether a progress sample is due.
 *
 * Paused and seek-driven frames publish immediately; playback is limited to
 * `PROGRESS_REFRESH_HZ` so a 144 Hz frame loop cannot commit React state 144
 * times per second.
 */
export function progressPublishDue(
  timestamp: number,
  lastPublishedAt: number,
  playing: boolean,
): boolean {
  if (!playing) {
    return true;
  }
  if (!Number.isFinite(timestamp) || !Number.isFinite(lastPublishedAt)) {
    return true;
  }
  if (timestamp < lastPublishedAt) {
    return true;
  }
  return timestamp - lastPublishedAt >= 1000 / PROGRESS_REFRESH_HZ;
}

/**
 * The registry surfaces a progress-card menu draws.
 *
 * A press on a marker keeps the progress rows and adds the marker surface, so a
 * row registered for `marker` reaches the same menu host as the card's own
 * rows. Any other press draws only the progress surface.
 */
export function progressMenuSurfaces(target?: ContextMenuTarget): ContextMenuSurface[] {
  return target?.surface === "marker" ? ["marker", "progress"] : ["progress"];
}

/** Builds a progress cell with default readouts and an unbound seek handler. */
export function createProgressState(): ProgressState {
  return Object.freeze({
    snapshot: createValue<ProgressSnapshot>({
      initial: {
        time: 0,
        duration: 600,
        chartTime: "0.000 s",
        beat: t("chrome.transport.beat", { value: "0.000" }),
        bpm: t("chrome.transport.bpm", { value: "120.00" }),
      },
    }),
    seekHandler: createLateBound<(seconds: number) => void>(),
  });
}

/** Publishes a progress snapshot, skipping the write when every field matches. */
export function setProgressSnapshot(state: ProgressState, next: ProgressSnapshot): void {
  const current = state.snapshot.get();
  if (
    current.time === next.time &&
    current.duration === next.duration &&
    current.chartTime === next.chartTime &&
    current.beat === next.beat &&
    current.bpm === next.bpm
  ) {
    return;
  }
  state.snapshot.set(next);
}

/** Sets the scrubber length, falling back to 600 seconds for invalid input. */
export function setProgressDuration(state: ProgressState, duration: number): void {
  state.snapshot.update({ duration: Number.isFinite(duration) && duration >= 0 ? duration : 600 });
}

/** Binds the seek callback; returns the function that clears the binding. */
export function setProgressSeekHandler(
  state: ProgressState,
  handler: (seconds: number) => void,
): () => void {
  return state.seekHandler.bind(handler);
}

/**
 * Forwards a finite seek position to the editor and mirrors it in the snapshot.
 *
 * A position already held by the snapshot is the playhead's current time, so it
 * is not forwarded again: the scrubber's native input and change events can
 * report the same value twice for one drag step.
 */
export function seekProgress(state: ProgressState, seconds: number): void {
  if (!Number.isFinite(seconds) || seconds === state.snapshot.get().time) {
    return;
  }
  state.seekHandler.value()?.(seconds);
  state.snapshot.update({ time: seconds });
}
