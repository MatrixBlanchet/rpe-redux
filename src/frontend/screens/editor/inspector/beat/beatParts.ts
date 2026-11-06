/**
 * The three boxes of a beat field, and the beat they describe.
 *
 * A beat is stored as three integers (`whole:numerator/denominator`), but an
 * author can type a decimal into any box. Leaving that box folds the decimal back
 * into the stored triple, exactly, without passing through a float:
 *
 * - a decimal in the whole box is the whole beat, so it replaces the fraction the
 *   other boxes hold: `3:3/4` with `3.5` in the whole box becomes `3:1/2`;
 * - a decimal in the numerator box is that many denominatorths, so the parts are
 *   put over a common denominator: `3:3/4` with `3.5` becomes `3:7/8`;
 * - a decimal in the denominator box divides the numerator: `3:3/4` with `3.5`
 *   becomes `3:6/7`.
 *
 * Integer input carries the way the chart reduces anyway (`3:5/4` is `4:1/4`).
 * A part that is not a number, a denominator that is not positive, or a beat the
 * triple cannot store is refused (`null`); the field then turns the boxes invalid
 * and leaves the chart alone.
 *
 * The math lives in `core/global/chart/timing/beat.ts` (`beatFromBigFraction`); this
 * module only reads the boxes.
 */
import { beatFromBigFraction, type Beat } from "../../../../../core/global/chart/timing/beat.ts";

export type Parts = [string, string, string];

/** One box's text as an exact fraction: `3`, `3.5`, `.5` and `3.` are all read. */
interface Fraction {
  numerator: bigint;
  denominator: bigint;
}

/** Reads one box as an exact fraction, or null when it is not a number. */
function fractionOf(text: string): Fraction | null {
  const match = /^(-)?(\d*)(?:\.(\d*))?$/.exec(text.trim());
  if (!match) {
    return null;
  }
  const [, sign, digits = "", fraction = ""] = match;
  if (!digits && !fraction) {
    return null;
  }
  const denominator = 10n ** BigInt(fraction.length);
  const scaled = (digits ? BigInt(digits) : 0n) * denominator + (fraction ? BigInt(fraction) : 0n);
  return { numerator: sign ? -scaled : scaled, denominator };
}

/** The boxes for a committed beat. */
export function partsOf(beat: readonly number[]): Parts {
  return [String(beat[0]), String(beat[1]), String(beat[2])];
}

/** The beat the boxes describe, or `null` while they are not a beat. */
export function draftBeat(parts: Parts): Beat | null {
  const whole = fractionOf(parts[0]);
  if (!whole) {
    return null;
  }
  try {
    // Decimal input in the whole box is the beat itself, so it replaces the
    // fraction the other boxes hold.
    if (parts[0].includes(".")) {
      return beatFromBigFraction(whole.numerator, whole.denominator);
    }
    const numerator = fractionOf(parts[1]);
    const denominator = fractionOf(parts[2]);
    if (!numerator || !denominator || denominator.numerator <= 0n) {
      return null;
    }
    // `whole + numerator/denominator`, each part exact.
    return beatFromBigFraction(
      whole.numerator * numerator.denominator * denominator.numerator +
        numerator.numerator * denominator.denominator * whole.denominator,
      whole.denominator * numerator.denominator * denominator.numerator,
    );
  } catch {
    return null;
  }
}
