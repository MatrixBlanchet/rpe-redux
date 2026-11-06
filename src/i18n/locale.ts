/**
 * Which language the interface speaks, and how that is decided.
 *
 * The store in `index.ts` owns the *current* language; this module owns the
 * vocabulary of languages and the rule for picking one at start-up. It is
 * deliberately free of storage and of React: the app layer decides where a
 * choice is remembered, and both the React shell and the imperative editor read
 * the result from `index.ts`.
 */

export const LANGUAGES = ["en", "zh"] as const;

export type Language = (typeof LANGUAGES)[number];

/** English, always, unless the machine asks for Chinese. */
export const DEFAULT_LANGUAGE: Language = "en";

/** Names shown in the language picker: each language names itself. */
export const LANGUAGE_NAMES: Record<Language, string> = {
  en: "English",
  zh: "简体中文",
};

/** The `lang` attribute written to `<html>`, for fonts and screen readers. */
export const HTML_LANG: Record<Language, string> = {
  en: "en",
  zh: "zh-CN",
};

/** True for a language tag the application ships a catalog for. */
export function isLanguage(value: unknown): value is Language {
  return typeof value === "string" && (LANGUAGES as readonly string[]).includes(value);
}

/**
 * Accepts what a locale tag looks like in the wild (`zh`, `zh-CN`, `zh-Hans-CN`,
 * `en-GB`, …) and returns the language this app can speak, or `null` when the
 * tag belongs to a language it cannot.
 */
export function normalizeLanguage(value: unknown): Language | null {
  if (typeof value !== "string") {
    return null;
  }
  const language = value.trim().toLowerCase().split(/[-_]/)[0];
  return isLanguage(language) ? language : null;
}

/** The tags the runtime reports, in the browser's own order of preference. */
function runtimeTags(): string[] {
  const nav = globalThis.navigator as
    { languages?: readonly string[]; language?: string } | undefined;
  if (!nav) {
    return [];
  }
  if (Array.isArray(nav.languages) && nav.languages.length) {
    return [...nav.languages];
  }
  return nav.language ? [nav.language] : [];
}

/**
 * First supported language among the machine's preferences, else English.
 *
 * Chinese is only chosen when the machine actually asks for it: a machine set to
 * `fr-FR` gets English, not the first catalog in the directory listing.
 */
export function detectLanguage(tags: readonly string[] = runtimeTags()): Language {
  for (const tag of tags) {
    const language = normalizeLanguage(tag);
    if (language) {
      return language;
    }
  }
  return DEFAULT_LANGUAGE;
}
