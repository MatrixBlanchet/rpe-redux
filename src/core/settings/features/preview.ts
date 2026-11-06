/**
 * The live-preview settings page: render frame rate, preview overlays and
 * game-UI scope.
 *
 * The page lives under the Editor category because every row changes what the
 * author sees while placing notes.
 */
import { settingsRegistry } from "../settings.ts";
import type { SettingDefinition } from "../types.ts";
import type { SettingsNavigation } from "../types.ts";

const PreviewSettingsNavigation: SettingsNavigation = {
  key: "editor.preview",
  parent: "editor",
  label: "settings.group.preview",
  icon: "preview",
  order: 50,
};

const PreviewSettingsSchema: SettingDefinition[] = [
  {
    key: "line-numbers",
    navigation: "editor.preview",
    group: "settings.group.livePreviewLines",
    label: "settings.field.line-numbers.label",
    control: "toggle",
    default: true,
  },
  {
    key: "line-arrows",
    navigation: "editor.preview",
    group: "settings.group.livePreviewLines",
    label: "settings.field.line-arrows.label",
    control: "toggle",
    default: true,
  },
  {
    key: "merge-line-numbers",
    navigation: "editor.preview",
    group: "settings.group.livePreviewLines",
    label: "settings.field.merge-line-numbers.label",
    description: "settings.field.merge-line-numbers.description",
    control: "toggle",
    default: true,
  },
  {
    key: "pick-preview-lines",
    navigation: "editor.preview",
    group: "settings.group.livePreviewLines",
    label: "settings.field.pick-preview-lines.label",
    control: "toggle",
    default: true,
  },
  {
    key: "preview-non-current-opacity",
    navigation: "editor.preview",
    group: "settings.group.previewScope",
    label: "settings.field.preview-non-current-opacity.label",
    control: "range",
    default: 180,
    min: 0,
    max: 255,
    step: 1,
  },
  {
    key: "preview-show-game-ui",
    navigation: "editor.preview",
    group: "settings.group.previewScope",
    label: "settings.field.preview-show-game-ui.label",
    description: "settings.field.preview-show-game-ui.description",
    control: "toggle",
    default: true,
  },
  {
    key: "preview-game-ui-corner-compression",
    navigation: "editor.preview",
    group: "settings.group.previewScope",
    label: "settings.field.preview-game-ui-corner-compression.label",
    description: "settings.field.preview-game-ui-corner-compression.description",
    control: "toggle",
    default: true,
    enabledWhen: { key: "preview-show-game-ui", equals: true },
  },
];
settingsRegistry.registerNavigation(PreviewSettingsNavigation);
settingsRegistry.registerSettings(PreviewSettingsSchema);
