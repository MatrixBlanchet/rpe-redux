/**
 * Line-information lifecycle.
 *
 * Key dispatch belongs to the single shortcut dispatcher; this module only
 * clears the line-information overlay when the window loses focus.
 */
import type { ResourceScope } from "../../../core/utils/resourceScope.ts";

/** Inputs for the line-information focus lifecycle. */
interface LineInfoLifecycleDependencies {
  scope: ResourceScope;
  hideLineInfo: () => void;
}

/** Hides line information when focus leaves the application. */
export function registerTransportShortcuts(deps: LineInfoLifecycleDependencies): void {
  deps.scope.listen(window, "blur", () => {
    deps.hideLineInfo();
  });
}
