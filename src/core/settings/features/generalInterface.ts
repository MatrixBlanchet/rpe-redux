/**
 * General → Interface rows.
 *
 * The interface theme and the playback frame-rate cap shape the application
 * rather than the chart, so they belong beside language on General → Interface.
 */
import { settingsRegistry } from "../settings.ts";
import type { SettingDefinition } from "../types.ts";

const InterfaceSettings: SettingDefinition[] = [
  {
    key: "appearance-skin",
    navigation: "general.interface",
    group: "settings.group.interface",
    label: "settings.field.appearance-skin.label",
    description: "settings.theme.description",
    control: "custom",
    default: "dark",
  },
  {
    key: "render-fps",
    navigation: "general.interface",
    group: "settings.group.interface",
    label: "settings.field.render-fps.label",
    control: "select",
    default: "144",
    options: [
      { value: "30", label: "settings.option.render-fps.30" },
      { value: "60", label: "settings.option.render-fps.60" },
      { value: "90", label: "settings.option.render-fps.90" },
      { value: "120", label: "settings.option.render-fps.120" },
      { value: "144", label: "settings.option.render-fps.144" },
    ],
  },
];

settingsRegistry.registerSettings(InterfaceSettings);
