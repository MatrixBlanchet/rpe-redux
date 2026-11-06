/**
 * Search normalisation for the settings catalog.
 *
 * Chinese search adds pinyin and initials for translated text while English stays
 * literal, so the same query works in either language.
 */
import { pinyin } from "pinyin-pro";

import { getLanguage } from "../../../i18n/index.ts";

const HAN_CHARACTERS = /[\u3400-\u9fff]/u;

/** Fold width, case, and whitespace so aliases compare against the same query shape. */
function normalizeSearchText(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase().replace(/\s+/gu, "");
}

/**
 * Search aliases for a visible settings string.
 *
 * Chinese mode keeps the translated text and English catalog text searchable,
 * then adds full pinyin and initials for strings containing Han characters.
 * English mode stays on the cheaper literal path and does not make pinyin a
 * hidden source of matches.
 */
export function settingsSearchAliases(value: string, englishValue?: string): string[] {
  const aliases = new Set([normalizeSearchText(value)]);
  if (getLanguage() !== "zh") {
    return [...aliases];
  }

  if (englishValue !== undefined) {
    aliases.add(normalizeSearchText(englishValue));
  }
  if (!HAN_CHARACTERS.test(value)) {
    return [...aliases];
  }

  aliases.add(
    normalizeSearchText(
      pinyin(value, {
        toneType: "none",
        nonZh: "consecutive",
      }),
    ),
  );
  aliases.add(
    normalizeSearchText(
      pinyin(value, {
        pattern: "first",
        nonZh: "consecutive",
      }),
    ),
  );
  return [...aliases];
}

/** Whether any alias for the visible text contains the normalized query. */
export function matchesSettingsSearch(
  value: string,
  query: string,
  englishValue?: string,
): boolean {
  const normalizedQuery = normalizeSearchText(query);
  return settingsSearchAliases(value, englishValue).some((alias) =>
    alias.includes(normalizedQuery),
  );
}
