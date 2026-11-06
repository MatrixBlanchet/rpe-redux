/**
 * The language selector for the settings catalog.
 *
 * A change is written as a preference and repaints the interface through the
 * translation runtime.
 */
import type { SettingDefinition } from "../../../../core/settings/types.ts";
import { PREFERENCE_SECTIONS, writePreference } from "../../../../core/state/preferences.ts";
import { LANGUAGE_NAMES, LANGUAGES, setLanguage } from "../../../../i18n/index.ts";
import { Select } from "../../../../design/components/select/Select.tsx";
import { useTranslation } from "../../../../i18n/react.ts";
import { registerSettingControl } from "../settingsContributions.ts";

/** Language selector that persists the choice and repaints through the i18n runtime. */
export function LanguageControl({ field }: { field: SettingDefinition }) {
  const { language } = useTranslation();
  return (
    <Select
      id={field.key}
      value={language}
      onChange={(event) => {
        writePreference(PREFERENCE_SECTIONS.language, setLanguage(event.target.value));
      }}
    >
      {LANGUAGES.map((code) => (
        <option key={code} value={code}>
          {LANGUAGE_NAMES[code]}
        </option>
      ))}
    </Select>
  );
}

registerSettingControl("appearance-language", LanguageControl);
