/**
 * Regression coverage for the core secure random range helper.
 *
 * The trajectory editor uses this helper for seed randomization, where a
 * modulo operation on the raw cryptographic word would skew the distribution.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { secureRandomIntInclusive } from "../../../core/utils/random.ts";

test("secure random integer stays inside an inclusive range", () => {
  for (let index = 0; index < 64; index++) {
    const value = secureRandomIntInclusive(0, 100000);
    assert.ok(Number.isInteger(value));
    assert.ok(value >= 0 && value <= 100000);
  }
});

test("secure random integer rejects invalid or oversized ranges", () => {
  assert.throws(() => secureRandomIntInclusive(2, 1), RangeError);
  assert.throws(() => secureRandomIntInclusive(0, 0x1_0000_0000), RangeError);
});
