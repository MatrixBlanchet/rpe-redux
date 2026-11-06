/**
 * Page-background settings for the home page and editor window.
 *
 * The welcome page, editor window, and editor preview own separate controls.
 * The welcome page uses the selected library cover. The editor surfaces use the
 * open chart cover unless the custom background image overrides them.
 */
import { settingsRegistry } from "../settings.ts";
import type { SettingDefinition } from "../types.ts";

/** Setting keys read by the cover backdrop and the custom-image preview. */
export const COVER_BACKGROUND_KEYS = Object.freeze({
  welcomeEnabled: "welcome-cover-background-enabled",
  welcomeBlur: "welcome-cover-background-blur",
  welcomeBrightness: "welcome-cover-background-brightness",
  editorWindowEnabled: "editor-cover-background-enabled",
  editorWindowBlur: "editor-cover-background-blur",
  editorWindowBrightness: "editor-cover-background-brightness",
  editorPreviewEnabled: "editor-preview-background-enabled",
  customImage: "custom-background",
} as const);

/** Defaults shared by the settings schema and the backdrop components. */
export const COVER_BACKGROUND_DEFAULTS = Object.freeze({
  welcomeEnabled: true,
  welcomeBlur: 24,
  welcomeBrightness: 0.55,
  editorWindowEnabled: true,
  editorWindowBlur: 28,
  editorWindowBrightness: 0.5,
});

const CoverBackgroundSettingsSchema: SettingDefinition[] = [
  {
    key: COVER_BACKGROUND_KEYS.welcomeEnabled,
    navigation: "appearance.display",
    group: "settings.group.coverBackground",
    label: "settings.field.welcome-cover-background-enabled.label",
    description: "settings.field.welcome-cover-background-enabled.description",
    control: "toggle",
    default: COVER_BACKGROUND_DEFAULTS.welcomeEnabled,
  },
  {
    key: COVER_BACKGROUND_KEYS.welcomeBlur,
    navigation: "appearance.display",
    group: "settings.group.coverBackground",
    label: "settings.field.welcome-cover-background-blur.label",
    control: "range",
    default: COVER_BACKGROUND_DEFAULTS.welcomeBlur,
    min: 0,
    max: 60,
    step: 1,
    enabledWhen: { key: COVER_BACKGROUND_KEYS.welcomeEnabled, equals: true },
  },
  {
    key: COVER_BACKGROUND_KEYS.welcomeBrightness,
    navigation: "appearance.display",
    group: "settings.group.coverBackground",
    label: "settings.field.welcome-cover-background-brightness.label",
    control: "range",
    default: COVER_BACKGROUND_DEFAULTS.welcomeBrightness,
    min: 0.1,
    max: 1.5,
    step: 0.05,
    enabledWhen: { key: COVER_BACKGROUND_KEYS.welcomeEnabled, equals: true },
  },
  {
    key: COVER_BACKGROUND_KEYS.editorPreviewEnabled,
    navigation: "appearance.display",
    group: "settings.group.coverBackground",
    label: "settings.field.editor-preview-background-enabled.label",
    description: "settings.field.editor-preview-background-enabled.description",
    control: "toggle",
    default: true,
  },
  {
    key: COVER_BACKGROUND_KEYS.editorWindowEnabled,
    navigation: "appearance.display",
    group: "settings.group.coverBackground",
    label: "settings.field.editor-cover-background-enabled.label",
    description: "settings.field.editor-cover-background-enabled.description",
    control: "toggle",
    default: COVER_BACKGROUND_DEFAULTS.editorWindowEnabled,
  },
  {
    key: COVER_BACKGROUND_KEYS.editorWindowBlur,
    navigation: "appearance.display",
    group: "settings.group.coverBackground",
    label: "settings.field.editor-cover-background-blur.label",
    control: "range",
    default: COVER_BACKGROUND_DEFAULTS.editorWindowBlur,
    min: 0,
    max: 60,
    step: 1,
    enabledWhen: { key: COVER_BACKGROUND_KEYS.editorWindowEnabled, equals: true },
  },
  {
    key: COVER_BACKGROUND_KEYS.editorWindowBrightness,
    navigation: "appearance.display",
    group: "settings.group.coverBackground",
    label: "settings.field.editor-cover-background-brightness.label",
    control: "range",
    default: COVER_BACKGROUND_DEFAULTS.editorWindowBrightness,
    min: 0.1,
    max: 1.5,
    step: 0.05,
    enabledWhen: { key: COVER_BACKGROUND_KEYS.editorWindowEnabled, equals: true },
  },
];

settingsRegistry.registerSettings(CoverBackgroundSettingsSchema);
