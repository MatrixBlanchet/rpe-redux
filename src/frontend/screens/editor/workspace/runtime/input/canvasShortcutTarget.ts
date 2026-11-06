/** Maps a DOM input event to the canvas surface that actually owns it. */
import type { EditorShortcutArea } from "../../../../../../core/edit/shortcuts/declarations.ts";
import type { CanvasShortcutTarget } from "../../../../../platform/shortcuts/canvasShortcuts.ts";

interface CanvasTargetSurfaces {
  readonly preview: { readonly canvas: EventTarget };
  readonly timeline: {
    readonly stage: EventTarget;
    readonly notes: EventTarget;
    readonly notesBackdrop: EventTarget;
    readonly events: EventTarget;
    readonly eventsBackdrop: EventTarget;
  };
}

/** Resolves the shortcut target for a canvas or backdrop event, or null elsewhere. */
export function canvasShortcutTarget(
  event: Event,
  surfaces: CanvasTargetSurfaces,
  previewArea: EditorShortcutArea,
): CanvasShortcutTarget | null {
  const target = event.target;
  if (target === surfaces.timeline.notes || target === surfaces.timeline.notesBackdrop) {
    return { surface: "timeline", area: "notes" };
  }
  if (target === surfaces.timeline.events || target === surfaces.timeline.eventsBackdrop) {
    return { surface: "timeline", area: "events" };
  }
  if (target === surfaces.timeline.stage || target === surfaces.preview.canvas) {
    return { surface: "preview", area: previewArea };
  }
  return null;
}
