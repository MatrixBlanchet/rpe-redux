/** Progress-bar fraction clamps, indeterminate input, and invalid bounds. */
import assert from "node:assert/strict";
import test from "node:test";
import { progressRatio } from "../design/components/progress/progressValue.ts";

test("reports an indeterminate bar without a finite value", () => {
  assert.equal(progressRatio(undefined, 1), null);
  assert.equal(progressRatio(Number.NaN, 1), null);
  assert.equal(progressRatio(Number.POSITIVE_INFINITY, 1), null);
});

test("reports an indeterminate bar without a positive finite bound", () => {
  assert.equal(progressRatio(1, 0), null);
  assert.equal(progressRatio(1, -1), null);
  assert.equal(progressRatio(1, Number.NaN), null);
  assert.equal(progressRatio(1, Number.POSITIVE_INFINITY), null);
});

test("clamps completed fractions to the track", () => {
  assert.equal(progressRatio(0, 10), 0);
  assert.equal(progressRatio(5, 10), 0.5);
  assert.equal(progressRatio(10, 10), 1);
  assert.equal(progressRatio(-3, 10), 0);
  assert.equal(progressRatio(30, 10), 1);
});
