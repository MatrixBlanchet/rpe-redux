/**
 * The shortcuts settings category entry.
 *
 * The key editor renders itself, so this feature contributes only the
 * navigation item that places it among the schema-driven categories. Input is
 * its own root, like a game's keyboard tab: it is a large configuration surface,
 * not a preference about the application's appearance.
 */
import { settingsRegistry } from "../settings.ts";
import type { SettingsNavigation } from "../types.ts";

const ShortcutsSettingsNavigation: SettingsNavigation = {
  key: "shortcuts",
  label: "settings.category.shortcuts.label",
  icon: "keyboard",
  order: 50,
};
settingsRegistry.registerNavigation(ShortcutsSettingsNavigation);
