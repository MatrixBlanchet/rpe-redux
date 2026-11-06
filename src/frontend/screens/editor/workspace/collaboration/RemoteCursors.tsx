/**
 * Remote member markers over the timeline.
 *
 * Positions are recomputed from the live viewport on a short timer because
 * scrolling and zooming change the mapping without changing chart revision.
 * Presence is ephemeral and never enters the document history.
 */
import { useEffect, useState } from "react";
import { useEditorRuntime } from "../runtime/composition/EditorRuntime.tsx";
import { useCollaboration } from "./collaborationRuntime.tsx";

/** Draws other members' timeline cursors from the current presence snapshot. */
export function RemoteCursors() {
  const runtime = useEditorRuntime();
  const { state } = useCollaboration();
  const [now, setNow] = useState(0);

  useEffect(() => {
    if (!state.roomId || state.presence.length === 0) {
      return;
    }
    // Presence timestamps are wall-clock values; a short timer expires stale
    // entries even when no other state changes.
    const timer = window.setInterval(() => setNow(Date.now()), 120);
    return () => window.clearInterval(timer);
  }, [state.roomId, state.presence.length]);

  if (!runtime || !state.roomId) {
    return null;
  }
  const canvas = runtime.timeline.notesCanvas;
  const bounds = canvas.getBoundingClientRect();
  if (bounds.width <= 0 || bounds.height <= 0) {
    return null;
  }
  const session = runtime.getSession();
  const markers = state.presence.flatMap((presence) => {
    if (
      presence.memberId === state.memberId ||
      presence.area !== "edit" ||
      (now > 0 && now - presence.updatedAt > 5000)
    ) {
      return [];
    }
    if (!presence.lineId || presence.beat === undefined || presence.positionX === undefined) {
      return [];
    }
    const member = state.members.find((candidate) => candidate.id === presence.memberId);
    if (!member) {
      return [];
    }
    const lineIndex =
      session.chart.judgeLineList?.findIndex((line) => line.id === presence.lineId) ?? -1;
    if (lineIndex < 0) {
      return [];
    }
    const x = runtime.timeline.viewport.noteHorizontal(presence.positionX, lineIndex);
    const y = runtime.timeline.viewport.verticalForLine(
      presence.beat,
      lineIndex,
      runtime.timeline.viewport.viewHeight(),
      "notes",
    );
    if (x < 0 || y < 0 || x > canvas.clientWidth || y > canvas.clientHeight) {
      return [];
    }
    return [
      {
        id: presence.memberId,
        name: member.profile.name,
        color: member.profile.color,
        left: bounds.left + (x * bounds.width) / canvas.clientWidth,
        top: bounds.top + (y * bounds.height) / canvas.clientHeight,
      },
    ];
  });
  if (markers.length === 0) {
    return null;
  }
  return (
    <div className="collab-cursors" aria-hidden="true">
      {markers.map((marker) => (
        <div
          key={marker.id}
          className="collab-cursor"
          style={{ left: marker.left, top: marker.top, color: marker.color }}
        >
          <span className="collab-cursor-dot" />
          <span className="collab-cursor-name">{marker.name}</span>
        </div>
      ))}
    </div>
  );
}
