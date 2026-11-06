/**
 * The settings window's view of the settings registry.
 *
 * Categories, fields, navigation lookup, and translated text are read here so the
 * React surfaces never reach into the registry themselves.
 */
import { CATALOGS } from "../../../i18n/messages/index.ts";
import { t, tRaw, type MessageKey } from "../../../i18n/index.ts";
import type {
  SettingDefinition,
  SettingText,
  SettingsNavigation,
} from "../../../core/settings/types.ts";
import { settingsRegistry } from "../../../core/settings/settings.ts";
import "../../../core/settings/features/index.ts";
import { matchesSettingsSearch } from "./settingsSearch.ts";

/** Registry navigation and definition readers bound for the settings UI. */
export const settingsNavigations = settingsRegistry.navigations.bind(settingsRegistry);
/** Child navigation entries for one category key. */
export const settingsNavigationChildren =
  settingsRegistry.navigationChildren.bind(settingsRegistry);
/** Every registered setting definition. */
export const settingsDefinitions = settingsRegistry.definitions.bind(settingsRegistry);
/** Subscribe to catalog registration changes. */
export const subscribeSettingsCatalog = settingsRegistry.subscribe;

/** Resolve host setting keys with t(), and compressed Extension keys with tRaw(). */
export function settingText(value: SettingText): string {
  if (typeof value === "string") {
    return value.startsWith("extension::") ? tRaw(value) : t(value as MessageKey);
  }
  return tRaw(value.key, value.params);
}

/** English catalog text for host keys, used as a secondary search alias. */
function englishSettingText(value: SettingText): string | undefined {
  return typeof value === "string" && !value.startsWith("extension::")
    ? CATALOGS.en[value as MessageKey]
    : undefined;
}

/** Resolve a navigation key to its first page, or the key itself when it is a page. */
export function settingsNavigationTarget(key: string): string {
  const navigation = settingsRegistry.navigations().find((entry) => entry.key === key);
  if (!navigation) {
    return key;
  }
  return settingsRegistry.navigationChildren(key)[0]?.key ?? navigation.key;
}

/** Walk a navigation list from a key to its root, root first. */
export function navigationPathFrom(
  entries: readonly SettingsNavigation[],
  key: string,
): SettingsNavigation[] {
  const path: SettingsNavigation[] = [];
  let current = entries.find((entry) => entry.key === key);
  while (current) {
    path.unshift(current);
    current = current.parent ? entries.find((entry) => entry.key === current?.parent) : undefined;
  }
  return path;
}

/** The root-first path from the registry for one navigation key. */
export function settingsNavigationPath(key: string): SettingsNavigation[] {
  return navigationPathFrom(settingsRegistry.navigations(), key);
}

/** One translated breadcrumb segment for a search result. */
export interface SettingsSearchPathEntry {
  key: string;
  text: string;
}

/** Build one flat, translated path for a schema row shown by settings search. */
export function settingsSearchPath(definition: SettingDefinition): SettingsSearchPathEntry[] {
  const candidates = [
    ...settingsNavigationPath(definition.navigation).map((entry) => ({
      key: entry.key,
      text: settingText(entry.label),
    })),
    {
      key: `group:${definition.navigation}:${definition.group}`,
      text: settingText(definition.group),
    },
    // The row itself renders its label and description, so the breadcrumb ends
    // at the group.
  ];
  const path: SettingsSearchPathEntry[] = [];
  for (const candidate of candidates) {
    const text = candidate.text.trim();
    if (!text || path.at(-1)?.text === text) {
      continue;
    }
    path.push({ key: candidate.key, text });
  }
  return path;
}

/** The schema rows that belong to one navigation page. */
export function settingsFields(navigation: string): SettingDefinition[] {
  return settingsRegistry
    .definitions()
    .filter((definition) => definition.navigation === navigation);
}

/** Search the translated text visible to the user. */
export function searchSettings(query: unknown): SettingDefinition[] {
  const text = String(query ?? "");
  const definitions = settingsRegistry.definitions();
  if (!text.trim()) {
    return [...definitions];
  }
  const navigations = settingsRegistry.navigations();
  return definitions.filter((definition) => {
    const navigation = navigations.find((entry) => entry.key === definition.navigation);
    const parent = navigation?.parent
      ? navigations.find((entry) => entry.key === navigation.parent)
      : undefined;
    const fields: { value: SettingText; english?: string }[] = [
      { value: definition.label, english: englishSettingText(definition.label) },
      ...(definition.description
        ? [
            {
              value: definition.description,
              english: englishSettingText(definition.description),
            },
          ]
        : []),
      { value: definition.group, english: englishSettingText(definition.group) },
      ...(navigation
        ? [{ value: navigation.label, english: englishSettingText(navigation.label) }]
        : []),
      ...(parent ? [{ value: parent.label, english: englishSettingText(parent.label) }] : []),
    ];
    return fields.some(({ value, english }) =>
      matchesSettingsSearch(settingText(value), text, english),
    );
  });
}

/** Rows with the same group key share one translated heading. */
export function groupedSettings(
  definitions: readonly SettingDefinition[],
): { id: string; title: SettingDefinition["group"]; entries: SettingDefinition[] }[] {
  const groups = new Map<SettingDefinition["group"], SettingDefinition[]>();
  for (const definition of definitions) {
    let group = groups.get(definition.group);
    if (group === undefined) {
      group = [];
      groups.set(definition.group, group);
    }
    group.push(definition);
  }
  return [...groups].map(([id, entries]) => ({ id, title: id, entries }));
}
