/**
 * Reads the live keyboard context for the shortcut dispatcher.
 *
 * Scope decisions read this snapshot; individual modules do not test the home
 * flag, document state, modal stack, or DOM role on their own.
 */
import { getModalShortcutContext } from "../../../design/components/modal/Modal.tsx";
import { getPopup } from "../../../design/controls/controlActions.ts";
import { getEditorVisibility } from "../../../core/edit/state/visibility.ts";
import { developerMode } from "../../../core/platform/desktop/developer.ts";
import type { ShortcutContext } from "../../../core/shortcuts/types.ts";
import { isShortcutRecording } from "../../screens/settings/shortcuts/recordingState.ts";
import { isShortcutBlockingSurface, isTextEntry } from "./focus.ts";

/** Read the home state, document, modal, capture, and focus state for one key. */
export function readShortcutContext(target: EventTarget | null): ShortcutContext {
  const visibility = getEditorVisibility();
  const modal = getModalShortcutContext();
  const element = target instanceof Element ? target : null;
  const textEntry = isTextEntry(element);
  const surface = textEntry
    ? "text"
    : element?.closest('[role="menu"], [role="menubar"]')
      ? "menu"
      : getPopup() || isShortcutBlockingSurface(element)
        ? "dialog"
        : null;
  return {
    atHome: visibility.atHome,
    documentOpen: visibility.hasDocument,
    modal: modal.urgent ? "urgent" : modal.open ? "normal" : "none",
    capturing: isShortcutRecording(),
    developerMode: developerMode.get(),
    textEntry,
    surface,
  };
}
