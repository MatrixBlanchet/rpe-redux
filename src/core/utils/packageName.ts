/**
 * Display names supplied by skin and theme packages.
 *
 * A package may ship one plain name, or one name per interface language. The
 * package owns those strings; the host only picks the current language, so a
 * built-in package never borrows a key from the application's message catalog.
 */

export type PackageName = string | Readonly<Record<string, string>>;

const MAX_NAME = 200;

/** A non-empty trimmed string within the display-name length bound. */
function validText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= MAX_NAME;
}

/** Accept a plain package name or a language-keyed name map with valid text. */
export function isPackageName(value: unknown): value is PackageName {
  if (validText(value)) {
    return true;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const entries = Object.entries(value);
  return (
    entries.length > 0 &&
    entries.every(
      ([language, text]) => language.length >= 2 && language.length <= 16 && validText(text),
    )
  );
}

/** Pick the current language, then English, then the first entry. */
export function packageName(name: PackageName, language: string): string {
  if (typeof name === "string") {
    return name;
  }
  return name[language] ?? name.en ?? Object.values(name)[0] ?? "";
}
