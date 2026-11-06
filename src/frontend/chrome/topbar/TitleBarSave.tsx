/**
 * Title-bar save affordance and unsaved indicator.
 *
 * The title bar is always present, so it is
 * where an unsaved document has to be visible. The control stays hidden while
 * the document matches its saved baseline and shows a save button (with the
 * user's own `Ctrl+S` binding) as soon as it does not. The indicator is drawn
 * from the published `dirty` flag rather than from a poll, so a save clears it
 * in the same update that clears the baseline.
 */
import { useSyncExternalStore } from "react";
import { Button } from "../../../design/components/button/Button.tsx";
import { Icon } from "../../../design/components/icon/Icon.tsx";
import { useTranslation } from "../../../i18n/react.ts";
import { editorChromeCommands } from "../../contracts/editorCommands.ts";
import {
  getEditorVisibility,
  subscribeToEditorVisibility,
} from "../../../core/edit/state/visibility.ts";
import { useShortcuts } from "../../screens/settings/shortcuts/useShortcuts.ts";
import { ShortcutBindings } from "../../../design/components/keyboardHint/Kbd.tsx";

/** Save button plus the unsaved dot, hidden when the document is saved. */
export function TitleBarSave() {
  const { t } = useTranslation();
  const visibility = useSyncExternalStore(
    subscribeToEditorVisibility,
    getEditorVisibility,
    getEditorVisibility,
  );
  const bindings = useShortcuts();
  const saveKeys = bindings.find((entry) => entry.id === "document.save")?.bindings ?? [];
  if (visibility.atHome || !visibility.hasDocument || !visibility.dirty) {
    return null;
  }
  return (
    <Button
      variant="outlined"
      size="sm"
      density="compact"
      className="redux-titlebar-save"
      iconText
      data-tip-title={t("common.action.save")}
      data-tip-desc={t("chrome.titlebar.unsavedHint")}
      data-tip-key={saveKeys[0] ? undefined : "Ctrl+S"}
      onClick={() => editorChromeCommands()?.documents.saveDocument()}
    >
      <span className="redux-titlebar-save-dot" aria-hidden="true" />
      <Icon name="save" size={14} />
      <span className="redux-button-label">{t("common.action.save")}</span>
      <ShortcutBindings bindings={saveKeys} className="redux-shortcut-labels" />
    </Button>
  );
}
