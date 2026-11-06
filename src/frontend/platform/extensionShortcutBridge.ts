/**
 * Extension emergency recovery.
 *
 * The stop key is checked before scopes and modals, so it still works when a
 * package has made the ordinary input path unusable.
 */
import { extensionRuntime } from "../../core/extensions/extensionRuntime.ts";

/**
 * Install the emergency stop even when the editor is at home or a modal is
 * open. A broken package may be the reason the normal input path is unusable.
 */
export function installExtensionRecovery(): () => void {
  const onKeyDown = (event: KeyboardEvent) => {
    if (
      event.key !== "F11" ||
      !event.ctrlKey ||
      !event.altKey ||
      !event.shiftKey ||
      event.isComposing
    ) {
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    extensionRuntime.disableAll();
    document.documentElement.dataset.extensionsDisabled = "emergency";
    window.dispatchEvent(new CustomEvent("redux:extensions-disabled", { detail: "emergency" }));
  };
  window.addEventListener("keydown", onKeyDown, true);
  return () => window.removeEventListener("keydown", onKeyDown, true);
}
