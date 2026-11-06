/**
 * Capture-phase shortcut routing for pointer and wheel input over a canvas.
 *
 * A canvas surface only receives these shortcuts while it is the event target.
 * When another canvas covers the preview, the event resolves to that canvas and
 * the preview never sees the binding. A handled event is stopped here so the
 * canvas gesture below cannot run a second action for the same press.
 */
import type { ResourceScope } from "../../../core/utils/resourceScope.ts";
import type { EditorSession } from "../../../core/edit/session/session.ts";
import type {
  EditorShortcutArea,
  EditorShortcutSurface,
} from "../../../core/edit/shortcuts/declarations.ts";
import {
  matchEditorShortcut,
  matchRegisteredShortcut,
} from "../../../core/edit/shortcuts/shortcutCatalog.ts";
import { isTimelineWheelShortcut } from "../../../core/edit/shortcuts/timelineWheel.ts";
import { readShortcutContext } from "./shortcutContext.ts";

export type CanvasShortcutSurface = EditorShortcutSurface;

/** The canvas that owns the event and the editor area its bindings use. */
export interface CanvasShortcutTarget {
  readonly surface: CanvasShortcutSurface;
  readonly area: EditorShortcutArea;
}

export interface CanvasShortcutBindingDependencies {
  scope: ResourceScope;
  batchControlsActive(): boolean;
  getSession(): EditorSession;
  canvasTarget(event: Event): CanvasShortcutTarget | null;
  clearCanvasTarget(): void;
  /** Runs one matched shortcut through its direct runner. */
  runShortcut(id: string, input: unknown): void;
}

function hasSelection(session: EditorSession): boolean {
  const multiLine = [...(session.multiLineSelection?.values() ?? [])].some(
    (values) => values.size > 0,
  );
  const multiEvent = [...(session.multiEventSelection?.values() ?? [])].some(
    (values) => values.size > 0,
  );
  return Boolean(session.selection.size || session.eventSelection.size || multiLine || multiEvent);
}

export function registerCanvasShortcutBindings(deps: CanvasShortcutBindingDependencies): void {
  const actionFor = (event: MouseEvent | WheelEvent): string | null => {
    const context = readShortcutContext(event.target);
    if (context.capturing || deps.batchControlsActive()) {
      return null;
    }
    const target = deps.canvasTarget(event);
    if (!target) {
      deps.clearCanvasTarget();
      return null;
    }
    const session = deps.getSession();
    const editorAction = matchEditorShortcut(
      event,
      {
        area: target.area,
        hasSelection: hasSelection(session),
        surface: target.surface,
      },
      context,
    );
    return editorAction ?? matchRegisteredShortcut(event, context)?.id ?? null;
  };

  const handle = (event: PointerEvent | WheelEvent): void => {
    const action = actionFor(event);
    const target = deps.canvasTarget(event);
    if (!action || !target || (event.type === "wheel" && isTimelineWheelShortcut(action))) {
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    deps.runShortcut(action, { event, area: target.area, canvas: target.surface });
  };

  // A right-button binding still needs the native context menu suppressed,
  // but the action already ran on pointerdown. Do not run it twice.
  const suppressNativeAction = (event: MouseEvent): void => {
    if (!actionFor(event)) {
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
  };

  deps.scope.listen(window, "pointerdown", handle, true);
  deps.scope.listen(window, "wheel", handle, { capture: true, passive: false });
  deps.scope.listen(window, "contextmenu", suppressNativeAction, true);
}
