/**
 * Developer-only settings, shown after the help page's reveal gesture.
 *
 * It carries the performance HUD switch and runs the remaining developer
 * actions that would otherwise be reachable only through shortcuts.
 */
import { useId, useSyncExternalStore } from "react";
import { Button } from "../../../../design/components/button/Button.tsx";
import { FieldRow } from "../../../../design/components/field/FieldRow.tsx";
import { Icon, iconName } from "../../../../design/components/icon/Icon.tsx";
import { Input } from "../../../../design/components/input/Input.tsx";
import { useTranslation } from "../../../../i18n/react.ts";
import {
  runAction,
  toolbar,
  type ToolbarAction,
} from "../../../../core/shell/registries/toolbar.ts";
import { registerSettingsPage } from "../settingsContributions.ts";
import {
  isPerformanceHudEnabled,
  performanceHudEnabled,
  togglePerformanceHud,
} from "../../../overlays/performance/performanceHud.ts";

/** Developer actions exposed as buttons; the HUD switch is rendered separately. */
const DEVELOPER_ACTION_IDS = [
  "developer.probe",
  "developer.copySelection",
  "developer.copyReport",
  "developer.detachPerformanceHud",
  "developer.showDiagnostics",
  "developer.copyDiagnostics",
  "developer.openAppData",
  "developer.openLogs",
  "developer.reload",
] as const;

/** Buttons for the developer actions that have no dedicated control. */
function DeveloperActionButtons() {
  const { tRaw } = useTranslation();
  const actions = DEVELOPER_ACTION_IDS.map((id) => toolbar.node(id)).filter(
    (entry): entry is ToolbarAction => entry?.kind === "action",
  );
  return (
    <div className="redux-developer-actions">
      {actions.map((action) => (
        <Button
          key={action.id}
          variant="outlined"
          iconText
          onClick={() => {
            runAction(action);
          }}
        >
          <Icon name={iconName(action.icon)} size={16} />
          <span className="redux-button-label">{tRaw(action.label)}</span>
        </Button>
      ))}
    </div>
  );
}

/** Developer-only settings mounted after the help logo reveal. */
export function DeveloperSettings() {
  const { t } = useTranslation();
  const performanceHudEnabledValue = useSyncExternalStore(
    performanceHudEnabled.subscribe,
    isPerformanceHudEnabled,
    isPerformanceHudEnabled,
  );
  const developerTitleId = useId();

  return (
    <section
      className="redux-setting-group redux-developer-settings"
      aria-labelledby={developerTitleId}
    >
      <h3 id={developerTitleId}>{t("settings.help.developer.title")}</h3>
      <FieldRow
        className="redux-setting"
        data-control="toggle"
        htmlFor="performance-hud-enabled"
        label={t("settings.help.developer.performanceHud")}
        description={t("settings.help.developer.performanceHudHint")}
        control={
          <Input
            id="performance-hud-enabled"
            type="checkbox"
            checked={performanceHudEnabledValue}
            onChange={togglePerformanceHud}
          />
        }
      />
      <DeveloperActionButtons />
    </section>
  );
}

registerSettingsPage("developer", {
  keywords: "settings.search.developerKeywords",
  component: DeveloperSettings,
});
