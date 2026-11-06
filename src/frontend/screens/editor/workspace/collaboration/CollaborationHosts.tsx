/** Window-level host for remote cursors; room controls live in the inspector. */
import "./register.ts";
import { RemoteCursors } from "./RemoteCursors.tsx";
import { RemotePlayheads } from "./RemotePlayheads.tsx";

/** Mounts the presence cursor and playhead layers beside the editor surfaces. */
export function CollaborationHosts() {
  return (
    <>
      <RemoteCursors />
      <RemotePlayheads />
    </>
  );
}
