/** Media transport time formatting and offset normalization. */
import assert from "node:assert/strict";
import test from "node:test";
import { formatMediaTime, mediaSeconds } from "../design/components/media/mediaTime.ts";

test("formats whole seconds as m:ss", () => {
  assert.equal(formatMediaTime(0), "0:00");
  assert.equal(formatMediaTime(5), "0:05");
  assert.equal(formatMediaTime(59), "0:59");
  assert.equal(formatMediaTime(60), "1:00");
  assert.equal(formatMediaTime(125), "2:05");
});

test("floors fractional seconds and clamps invalid input to zero", () => {
  assert.equal(formatMediaTime(5.99), "0:05");
  assert.equal(formatMediaTime(-1), "0:00");
  assert.equal(formatMediaTime(Number.NaN), "0:00");
  assert.equal(formatMediaTime(Number.POSITIVE_INFINITY), "0:00");
});

test("keeps a finite non-negative media offset and clamps negatives", () => {
  assert.equal(mediaSeconds(undefined), undefined);
  assert.equal(mediaSeconds(Number.NaN), undefined);
  assert.equal(mediaSeconds(Number.POSITIVE_INFINITY), undefined);
  assert.equal(mediaSeconds(-2), 0);
  assert.equal(mediaSeconds(12.5), 12.5);
});
