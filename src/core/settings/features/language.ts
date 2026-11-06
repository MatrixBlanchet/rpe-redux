/**
 * The language row on the General → Interface page.
 *
 * The row is a custom control because switching locale reloads the catalogs;
 * the schema only names the preference and its default so the page owns the
 * interaction.
 */
import { settingsRegistry } from "../settings.ts";
import type { SettingDefinition } from "../types.ts";

const LanguageSettings: SettingDefinition[] = [
  {
    key: "appearance-language",
    navigation: "general.interface",
    group: "settings.group.interface",
    label: "common.language",
    control: "custom",
    default: "zh",
  },
];

settingsRegistry.registerSettings(LanguageSettings);
