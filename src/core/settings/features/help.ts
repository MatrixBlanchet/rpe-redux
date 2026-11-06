/** Help and About settings destinations in the settings catalog. */
import { settingsRegistry } from "../settings.ts";
import type { SettingDefinition, SettingsNavigation } from "../types.ts";

/**
 * The Help page owns update status and the survey; its update preference rows
 * are schema fields under the same navigation key. About is a separate root
 * because it carries the product and publisher information, not help actions.
 */
const HelpSettingsNavigation: SettingsNavigation = {
  key: "help",
  label: "settings.category.help.label",
  icon: "info",
  order: 65,
};

const AboutSettingsNavigation: SettingsNavigation = {
  key: "about",
  label: "settings.category.about.label",
  icon: "star",
  order: 70,
};

const HelpSettingsSchema: SettingDefinition[] = [
  {
    key: "help-onboarding",
    navigation: "help",
    group: "",
    label: "settings.field.onboarding-guide.label",
    control: "action",
    // The row already shows its label; repeating it in a hover tip is noise.
    tooltip: false,
    action: { kind: "action", actionId: "help.onboarding", icon: "forward" },
  },
];

settingsRegistry.registerNavigation(HelpSettingsNavigation);
settingsRegistry.registerNavigation(AboutSettingsNavigation);
settingsRegistry.registerSettings(HelpSettingsSchema);
