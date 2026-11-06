/**
 * The per-setting reset affordance.
 *
 * It appears to the left of the value whenever the committed value differs from
 * the schema default. Hovering raises the icon to full contrast. Clicking writes
 * the default through the same commit path as a manual edit; it deliberately
 * does not add a stripe to the row.
 */
import { IconButton } from "../../../design/components/button/IconButton.tsx";
import { useTranslation } from "../../../i18n/react.ts";
import type { SettingDefinition, SettingValue } from "../../../core/settings/types.ts";
import { settingText } from "./settingsCatalog.ts";
import { useSetting } from "./useSetting.ts";

/** Whether the committed value differs from the schema default under its control's comparison. */
function differs(field: SettingDefinition, current: SettingValue): boolean {
  const fallback = field.default;
  if (fallback === undefined) {
    return false;
  }
  if (field.control === "toggle") {
    return current !== fallback;
  }
  const currentText = String(current);
  const fallbackText = String(fallback);
  if (currentText === fallbackText) {
    return false;
  }
  if (field.control === "number" || field.control === "range") {
    const value = Number(current);
    const defaultValue = Number(fallback);
    if (Number.isFinite(value) && Number.isFinite(defaultValue)) {
      return value !== defaultValue;
    }
  }
  if (field.control === "color") {
    return currentText.trim().toUpperCase() !== fallbackText.trim().toUpperCase();
  }
  return true;
}

/** Reset one setting to its schema default; hidden when already at the default. */
export function SettingReset({
  field,
  onReset,
  disabled = false,
}: {
  field: SettingDefinition;
  onReset(field: SettingDefinition, value: SettingValue): void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const fallback = field.default;
  const current = useSetting<SettingValue>(field.key, fallback ?? "");
  if (fallback === undefined || field.control === "action" || !differs(field, current)) {
    return null;
  }
  const name = settingText(field.label);
  return (
    <IconButton
      icon="undo"
      size={16}
      variant="ghost"
      className="redux-setting-reset"
      label={t("settings.reset.label", { name })}
      title={t("settings.reset.tooltip")}
      disabled={disabled}
      onClick={() => onReset(field, fallback)}
    />
  );
}
