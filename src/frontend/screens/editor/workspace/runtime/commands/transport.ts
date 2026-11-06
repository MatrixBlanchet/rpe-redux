/**
 * The transport, as the commands see it.
 *
 * Play, audition, rewind and seek are reached from the View menu, the top bar's
 * play button, the editor's own keys and a plugin's script. They live here
 * rather than in a table the editor installs, so each surface names a function:
 * `transport.beginAudition()` is this file's function, not an entry looked up by
 * name.
 *
 * The editor connects its transport — the audio clock, the seek policy, the frame
 * invalidation — while it mounts, and disconnects it when it is disposed. Nothing
 * is connected while the shell is at the start page, so a command that fires then
 * does nothing rather than throwing.
 */
import { beatValue, parseBeat } from "../../../../../../core/global/chart/timing/beat.ts";
import type { EditorPlayback } from "../../../../../../core/edit/playback/transport.ts";
import type { EditorSession } from "../../../../../../core/edit/session/session.ts";
import { editorAuditioning } from "../../../../../../core/edit/state/publishedValues.ts";
import { createLateBound } from "../../../../../../core/utils/lateBound.ts";

/** Services the transport commands operate on. */
export interface TransportBindings {
  /** Play, or stop what is playing. */
  togglePlayback(): Promise<unknown>;
  /** Seek to one beat, as the session counts beats. */
  seekBeat(beat: number): void;
  playback: Pick<EditorPlayback, "play" | "pause" | "seek" | "audio">;
  getSession(): EditorSession;
  invalidate(): void;
  reportError(error: unknown): void;
}

const transportBindings = createLateBound<TransportBindings>();

/** Hands the mounted editor's transport to the commands below. */
export function connectTransport(bindings: TransportBindings): () => void {
  auditionAnchor = null;
  editorAuditioning.set(false);
  return transportBindings.bind(bindings);
}

/** Audio position captured when the current audition began. */
let auditionAnchor: number | null = null;

/** Play, or stop what is playing. */
export function togglePlayback(): void {
  // A held audition owns the transport; play/pause stays inert for its duration.
  if (auditionAnchor !== null) {
    return;
  }
  transportBindings.value()?.togglePlayback();
}

/**
 * Start a temporary audition at the current audio position.
 *
 * The toolbar's hold button and the held Space shortcut use this so releasing
 * the control returns to the moment the user was inspecting.
 */
export function beginAudition(): void {
  const bound = transportBindings.value();
  if (!bound || bound.playback.audio.playing || auditionAnchor !== null) {
    return;
  }
  auditionAnchor = bound.playback.audio.time;
  editorAuditioning.set(true);
  void bound.playback
    .play(bound.getSession().chart)
    .then(bound.invalidate)
    .catch((error) => {
      auditionAnchor = null;
      editorAuditioning.set(false);
      bound.reportError(error);
    });
}

/** Stop a temporary audition and return to its starting position. */
export function endAudition(): void {
  const bound = transportBindings.value();
  if (auditionAnchor === null) {
    return;
  }
  const anchor = auditionAnchor;
  auditionAnchor = null;
  editorAuditioning.set(false);
  if (!bound) {
    return;
  }
  bound.playback.seek(anchor);
  bound.invalidate();
}

/** Go back to the first beat without starting the transport. */
export function rewind(): void {
  transportBindings.value()?.seekBeat(0);
}

/** Seek to one beat, written as the field that asked holds it. */
export function seekToBeat(beat: string): void {
  const bound = transportBindings.value();
  if (!bound) {
    return;
  }
  try {
    bound.seekBeat(beatValue(parseBeat(beat)));
  } catch (error) {
    bound.reportError(error);
  }
}

/** The transport commands, as the menu, the bar and the keys see them. */
export const transport = Object.freeze({
  togglePlayback,
  beginAudition,
  endAudition,
  rewind,
  seekToBeat,
});
