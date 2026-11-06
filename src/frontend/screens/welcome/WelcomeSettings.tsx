/**
 * The home screen's preferences entry point.
 *
 * It sits in the page header and runs the same command and shortcut as the
 * toolbar's settings action.
 */
import { Button } from "../../../design/components/button/Button.tsx";
import { Icon } from "../../../design/components/icon/Icon.tsx";
import { useTranslation } from "../../../i18n/react.ts";
import { openSettings } from "../settings/settingsWindowController.ts";

/** Header button that opens the settings window from the home screen. */
export function WelcomeSettings() {
  const { t } = useTranslation();
  const label = t("workspace.welcome.settings");
  return (
    <Button
      variant="outlined"
      className="redux-welcome-settings"
      aria-label={label}
      data-tip-action="workspace.settings"
      onClick={() => openSettings()}
    >
      <Icon name="settings" size={16} />
      <span className="redux-button-label">{label}</span>
    </Button>
  );
}
