/**
 * Vocabulary of the internationalisation layer.
 *
 * A *catalog* is a flat map from a dotted key to the text that key renders.
 * Catalogs are stored one namespace per file (see `messages/`), merged into a
 * single lookup table per language, and never nested: a missing key is a plain
 * property that reads back as `undefined`.
 */

/** Values a `{placeholder}` can be replaced with. */
export type MessageParams = Record<string, string | number>;

/** One flat language catalog: dotted key -> rendered text. */
export type Catalog = Record<string, string>;

/**
 * Fills `{name}` placeholders.
 *
 * Unknown placeholders are left untouched, so a typo stays visible in the
 * rendered string.
 */
export function interpolate(text: string, params: MessageParams | undefined): string {
  if (!params) {
    return text;
  }
  return text.replace(/\{(\w+)\}/g, (whole, name: string) =>
    Object.hasOwn(params, name) ? String(params[name]) : whole,
  );
}
