/**
 * Editor-wide browser events, bound to the editor's resource scope.
 *
 * The unload guard, resize invalidation, and visibility reset all live here so the
 * runtime has one place to release them.
 */
import type { ResourceScope } from "../../core/utils/resourceScope.ts";

export interface EditorWindowBindings {
  hasUnsavedChanges(): boolean;
  invalidate(): void;
  resetFrameTimestamp(): void;
}

/** Bind editor-wide browser events to their editor resource scope. */
export function bindEditorWindowEvents(bindings: EditorWindowBindings, scope: ResourceScope): void {
  scope.listen(window, "beforeunload", (event) => {
    if (bindings.hasUnsavedChanges()) {
      event.preventDefault();
      // `BeforeUnloadEvent.returnValue` is boolean; false requests the leave confirmation.
      event.returnValue = false;
    }
  });
  scope.listen(window, "resize", bindings.invalidate);
  scope.listen(document, "visibilitychange", bindings.resetFrameTimestamp);
}
