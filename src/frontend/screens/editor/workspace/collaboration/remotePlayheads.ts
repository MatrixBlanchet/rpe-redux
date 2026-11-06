/**
 * Pure presence-to-band mapping for other members' playhead ticks.
 *
 * Presence is ephemeral: only the edit workspace, a live timestamp, and a known
 * member with a playhead beat can produce a tick. The ratio is the same
 * audio-position ratio the local timeline markers use, so both layers share the
 * scrubber geometry.
 */
import { markerAudioRatio } from "../../../../../core/global/chart/timelineMarkers.ts";
import type { MemberPresence, RoomMember } from "../../../../../core/collaboration/types.ts";

/** The tempo surface needed to convert a beat into chart seconds. */
export interface RemotePlayheadTempo {
  seconds(beat: number): number;
}

/** One remote playhead ready to place on the transport band. */
export interface RemotePlayheadMarker {
  readonly id: string;
  readonly name: string;
  readonly color: string;
  /** Position along the scrubber, in the closed range `[0, 1]`. */
  readonly ratio: number;
}

/**
 * Build the visible remote playheads for one presence snapshot.
 *
 * Self, non-edit areas, stale entries, unknown members, malformed beats, and
 * unparseable tempo positions are skipped instead of drawing a guessed tick.
 */
export function buildRemotePlayheads({
  presence,
  members,
  selfId,
  now,
  tempo,
  offsetSeconds,
  duration,
  staleMs = 5000,
}: {
  presence: readonly MemberPresence[];
  members: readonly RoomMember[];
  selfId: string;
  now: number;
  tempo: RemotePlayheadTempo;
  offsetSeconds: number;
  duration: number;
  staleMs?: number;
}): RemotePlayheadMarker[] {
  return presence.flatMap((entry) => {
    if (
      entry.memberId === selfId ||
      entry.area !== "edit" ||
      entry.playheadBeat === undefined ||
      (now > 0 && now - entry.updatedAt > staleMs)
    ) {
      return [];
    }
    const member = members.find((candidate) => candidate.id === entry.memberId);
    if (!member) {
      return [];
    }
    let chartSeconds: number;
    try {
      chartSeconds = tempo.seconds(entry.playheadBeat);
    } catch {
      return [];
    }
    return [
      {
        id: entry.memberId,
        name: member.profile.name,
        color: member.profile.color,
        ratio: markerAudioRatio(chartSeconds, offsetSeconds, duration),
      },
    ];
  });
}
