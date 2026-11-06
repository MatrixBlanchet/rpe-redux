/**
 * Tooltip title normalization: the one rule that keeps placeholder-shaped
 * values out of the shared tooltip broker.
 *
 * A control occasionally annotates itself with a bare index, a count, or a
 * bracket-wrapped number instead of a label. Real titles carry a word, a unit,
 * or a range, so those placeholder shapes are dropped rather than painted as a
 * meaningless tooltip header.
 */

const BARE_NUMBER = /^[+-]?\p{Nd}+(?:[.,]\p{Nd}+)?$/u;
const BRACKETED_NUMBER = /^[（(]\s*[+-]?\p{Nd}+(?:[.,]\p{Nd}+)?\s*[）)]$/u;
const EMPTY_BRACKETS = /^[（(]\s*[）)]$/u;
const PUNCTUATION_ONLY = /^[\p{P}\p{Z}\s]+$/u;

/**
 * Normalize one tooltip title.
 *
 * Returns an empty string when the value is blank, a bare number, a
 * bracket-wrapped number, empty brackets, or only punctuation and whitespace.
 * Every other value is returned unchanged so labels such as `1x`, `10%`,
 * `X 坐标`, and `截取起点（0–1）` keep their meaning.
 */
export function tooltipTitle(value: string | undefined): string {
  const candidate = value?.trim() ?? "";
  if (!candidate) {
    return "";
  }
  if (
    BARE_NUMBER.test(candidate) ||
    BRACKETED_NUMBER.test(candidate) ||
    EMPTY_BRACKETS.test(candidate) ||
    PUNCTUATION_ONLY.test(candidate)
  ) {
    return "";
  }
  return value ?? "";
}
