/** Host language adapter for Extension-provided translation catalogs. */
import {
  getLanguage,
  registerExternalCatalog,
  tRaw,
  type Language,
  type MessageParams,
} from "../../i18n/index.ts";
import { interpolate, type Catalog } from "../../i18n/types.ts";

/** One language's bare-key catalog. */
export type ExtensionCatalog = Readonly<Record<string, string>>;
/** Catalogs keyed by language; English is the fallback. */
export type ExtensionTranslations = Partial<Record<Language, ExtensionCatalog>>;
/** A literal string or a catalog key with optional interpolation parameters. */
export type ExtensionText = string | { key: string; params?: MessageParams };

/** Translation helpers bound to one package's catalog namespace. */
export interface ExtensionI18n {
  readonly language: () => Language;
  readonly t: (key: string, params?: MessageParams) => string;
  readonly key: (value: ExtensionText) => string;
  readonly text: (value: ExtensionText) => string;
}

/** Qualify a bare package key with its owner for the host catalog. */
export function extensionCatalogKey(owner: string, key: string): string {
  return `extension::${owner}::${key}`;
}

/** Reject keys that already carry a host-owned Extension prefix. */
function assertBareCatalogKey(key: string): void {
  if (key.startsWith("extension.") || key.startsWith("extension::")) {
    throw new Error(`Extension catalog keys must be bare; rejected key: ${key}`);
  }
}

/** Resolve a key through the active catalog, then English, then the bare key. */
function localText(
  catalog: ExtensionCatalog | undefined,
  fallback: ExtensionCatalog | undefined,
  value: ExtensionText,
): string {
  if (typeof value === "string") {
    return value;
  }
  const text = catalog?.[value.key] ?? fallback?.[value.key] ?? value.key;
  return interpolate(text, value.params);
}

/**
 * Register one package's catalogs under its owner namespace.
 *
 * Adds the `category` label used by host surfaces; returns the catalog disposer.
 */
export function registerExtensionTranslations(
  owner: string,
  translations: ExtensionTranslations | undefined,
  name: ExtensionText,
): () => void {
  const catalogs: Partial<Record<Language, Catalog>> = {};
  for (const language of ["en", "zh"] as const) {
    const catalog = translations?.[language];
    const fallback = translations?.en;
    for (const key of Object.keys(catalog ?? {})) {
      assertBareCatalogKey(key);
    }
    catalogs[language] = {
      ...Object.fromEntries(
        Object.entries(catalog ?? {}).map(([key, value]) => [
          extensionCatalogKey(owner, key),
          value,
        ]),
      ),
      [extensionCatalogKey(owner, "category")]: `Extension: ${localText(catalog, fallback, name)}`,
    };
  }
  return registerExternalCatalog(owner, catalogs);
}

/** Resolve one text value against the current language, falling back to English. */
export function resolveExtensionText(
  owner: string,
  translations: ExtensionTranslations | undefined,
  value: ExtensionText,
): string {
  if (typeof value === "string") {
    return value;
  }
  return localText(translations?.[getLanguage()], translations?.en, value);
}

/** The host catalog key for a text value; literals pass through unchanged. */
export function extensionTextKey(owner: string, value: ExtensionText): string {
  return typeof value === "string" ? value : extensionCatalogKey(owner, value.key);
}

/** Build the translation helpers one package receives in its context. */
export function createExtensionI18n(
  owner: string,
  translations: ExtensionTranslations | undefined,
): ExtensionI18n {
  return {
    language: getLanguage,
    t: (key, params) => tRaw(extensionCatalogKey(owner, key), params),
    key: (value) => extensionTextKey(owner, value),
    text: (value) => resolveExtensionText(owner, translations, value),
  };
}
