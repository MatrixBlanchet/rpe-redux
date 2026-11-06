/**
 * The files settings page under General: autosave timing and retention, session
 * restore, and the action that opens the data folder.
 *
 * Autosave rows are read by the workspace's editor assembly through their
 * registered keys, so changing a default here changes the save policy without
 * a second constant.
 */
import { settingsRegistry } from "../settings.ts";
import type { SettingDefinition } from "../types.ts";
import type { SettingsNavigation } from "../types.ts";

const FilesSettingsNavigation: SettingsNavigation = {
  key: "files",
  parent: "general",
  label: "settings.group.files",
  icon: "save",
  order: 20,
};

const AUTOSAVE_ENABLED = { key: "autosave-enabled", equals: true } as const;

const FilesSettingsSchema: SettingDefinition[] = [
  {
    key: "session-restore",
    navigation: "files",
    group: "settings.group.files",
    label: "settings.field.session-restore.label",
    control: "toggle",
    default: true,
  },
  {
    key: "autosave-enabled",
    navigation: "files",
    group: "settings.group.files",
    label: "settings.field.autosave-enabled.label",
    control: "toggle",
    default: true,
  },
  {
    key: "autosave-seconds",
    navigation: "files",
    group: "settings.group.files",
    label: "settings.field.autosave-seconds.label",
    control: "number",
    default: 60,
    min: 1,
    max: 3600,
    step: 1,
    enabledWhen: AUTOSAVE_ENABLED,
  },
  {
    key: "autosave-limit",
    navigation: "files",
    group: "settings.group.files",
    label: "settings.field.autosave-limit.label",
    control: "number",
    default: 10,
    min: 1,
    max: 100,
    step: 1,
    enabledWhen: AUTOSAVE_ENABLED,
  },
  {
    key: "files.open-data-folder",
    navigation: "files",
    group: "settings.group.files",
    label: "settings.field.open-data-folder.label",
    control: "action",
    tooltip: false,
    action: { kind: "action", actionId: "files.openAppData" },
  },
];
settingsRegistry.registerNavigation(FilesSettingsNavigation);
settingsRegistry.registerSettings(FilesSettingsSchema);
