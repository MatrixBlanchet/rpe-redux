/**
 * Resize frame for the undecorated window.
 *
 * Linux window managers give an undecorated window no resize border, so the
 * shell forwards edge and corner drags to the host's native resize loop. Hosts
 * whose window manager already supplies a border render nothing here.
 */
import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { hostPlatform } from "../../core/platform/desktop/hostPlatform.ts";

/** The edge or corner a drag can start from. */
type ResizeDirection =
  "East" | "North" | "NorthEast" | "NorthWest" | "South" | "SouthEast" | "SouthWest" | "West";

/** Every handle, in painting order; corners last so they win the overlap. */
const HANDLES: readonly { direction: ResizeDirection; className: string }[] = [
  { direction: "North", className: "is-north" },
  { direction: "South", className: "is-south" },
  { direction: "West", className: "is-west" },
  { direction: "East", className: "is-east" },
  { direction: "NorthWest", className: "is-north-west" },
  { direction: "NorthEast", className: "is-north-east" },
  { direction: "SouthWest", className: "is-south-west" },
  { direction: "SouthEast", className: "is-south-east" },
];

/** Render the Linux resize frame, or nothing when the host supplies borders. */
export function WindowResizeHandles() {
  const [linux, setLinux] = useState(false);
  useEffect(() => {
    let mounted = true;
    void hostPlatform().then((platform) => {
      if (mounted) {
        setLinux(platform === "linux");
      }
    });
    return () => {
      mounted = false;
    };
  }, []);
  if (!linux) {
    return null;
  }
  return (
    <div className="redux-resize-frame" aria-hidden="true">
      {HANDLES.map(({ direction, className }) => (
        <div
          key={direction}
          className={`redux-resize-handle ${className}`}
          onPointerDown={(event) => {
            if (event.button === 0) {
              void getCurrentWindow().startResizeDragging(direction);
            }
          }}
        />
      ))}
    </div>
  );
}
