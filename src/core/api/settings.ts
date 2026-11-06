/**
 * Owns the settings contribution API.
 *
 * This handle registers navigation and schemas only. The settings page owns
 * presentation, while the value API owns reads, writes, persistence, and
 * subscriptions. A plugin declares a setting once and uses the same value id
 * everywhere else.
 *
 * Minimal usage:
 * ```js
 * redux.settings.registerNavigation({
 *   key: "plugin",
 *   label: "common.settings.title",
 *   order: 900,
 * });
 * redux.settings.registerSetting({
 *   key: "plugin.enabled",
 *   navigation: "plugin",
 *   group: "common.settings.title",
 *   label: "common.settings.title",
 *   description: "common.settings.title",
 *   control: "toggle",
 *   default: false,
 * });
 * redux.values.byId.set("plugin.enabled", true);
 * ```
 */
import type { SettingDefinition, SettingsNavigation } from "../settings/types.ts";
import { settingsRegistry } from "../settings/settings.ts";
import { createLateBound } from "../utils/lateBound.ts";

/** The mounted settings window opener, or null while unbound. */
const openHost = createLateBound<(page?: string) => void>();

/**
 * Bind the mounted settings window opener.
 *
 * Returns a disposer that clears this binding without affecting a newer one.
 */
export function connectSettingsOpen(open: (page?: string) => void): () => void {
  return openHost.bind(open);
}

/** Settings registrations available to the host and Extension owners. */
export interface SettingsApi {
  /** Add one navigation page; returns its disposer. */
  readonly registerNavigation: (navigation: SettingsNavigation) => () => void;
  /** Declare one setting and its value; returns its disposer. */
  readonly registerSetting: (definition: SettingDefinition) => () => void;
}

/**
 * Create the settings handle used by the host or by one Extension owner.
 *
 * `owner` stays outside the public shape so the host facade keeps one stable
 * settings door while Extension registrations carry an owner for ExtensionText
 * compression and uninstall cleanup.
 *
 * Registration only: reading and writing a setting goes through `redux.values`,
 * which enforces the declared value rule.
 */
export function createSettingsApi(owner?: string): SettingsApi {
  return Object.freeze({
    /** Add one navigation page under this owner. */
    registerNavigation: (navigation: SettingsNavigation) =>
      settingsRegistry.registerNavigation(navigation, owner),
    /** Declare one setting under this owner. */
    registerSetting: (definition: SettingDefinition) =>
      settingsRegistry.registerSetting(definition, owner),
  });
}

/** Settings contributions and window actions exposed to plugins. */
export const settings = Object.freeze({
  ...createSettingsApi(),
  /** Open the settings window, optionally on one page; false when unavailable. */
  open: (page?: string): boolean => {
    const open = openHost.value();
    open?.(page);
    return open !== null;
  },
});

export type { SettingDefinition, SettingText, SettingsNavigation } from "../settings/types.ts";
