/** Pointer-to-value mapping for range sliders: endpoints, step snapping, and guards. */
import assert from "node:assert/strict";
import test from "node:test";
import { valueAtPointer } from "../../../design/controls/sliderMode.ts";

const box = { left: 100, width: 200 };

test("the left edge maps to min and the right edge maps to max", () => {
  assert.equal(valueAtPointer(box, 0, 10, "1", 100), 0);
  assert.equal(valueAtPointer(box, 0, 10, "1", 300), 10);
});

test("points outside the box still clamp to an endpoint", () => {
  assert.equal(valueAtPointer(box, 0, 10, "1", 0), 0);
  assert.equal(valueAtPointer(box, 0, 10, "1", 400), 10);
  assert.equal(valueAtPointer(box, 0, 10, "1", Number.NEGATIVE_INFINITY), 0);
  assert.equal(valueAtPointer(box, 0, 10, "1", Number.POSITIVE_INFINITY), 10);
});

test("the endpoint wins even when max is not on the step grid", () => {
  assert.equal(valueAtPointer({ left: 0, width: 100 }, 0, 1, "0.3", 100), 1);
});

test("the middle of the box maps to the middle of the range", () => {
  assert.equal(valueAtPointer(box, 0, 10, "1", 200), 5);
});

test("a unit step snaps to the nearest grid point", () => {
  assert.equal(valueAtPointer(box, 0, 10, "1", 149), 2);
  assert.equal(valueAtPointer(box, 0, 10, "1", 160), 3);
});

test("a tenth step snaps without floating-point residue", () => {
  const bounds = { left: 0, width: 100 };
  assert.equal(valueAtPointer(bounds, 0, 1, "0.1", 30), 0.3);
  assert.equal(valueAtPointer(bounds, 0, 1, "0.1", 44), 0.4);
  assert.equal(valueAtPointer(bounds, 0, 1, "0.1", 46), 0.5);
  assert.equal(valueAtPointer(bounds, 0, 1, "0.1", 70), 0.7);
});

test("a non-zero min is the origin of the step grid", () => {
  const bounds = { left: 0, width: 300 };
  assert.equal(valueAtPointer(bounds, 0.5, 2, "0.1", 0), 0.5);
  assert.equal(valueAtPointer(bounds, 0.5, 2, "0.1", 75), 0.9);
  assert.equal(valueAtPointer(bounds, 0.5, 2, "0.1", 150), 1.3);
  assert.equal(valueAtPointer(bounds, 0.5, 2, "0.1", 300), 2);
});

test("a missing step and step=any snap to hundredths", () => {
  const bounds = { left: 0, width: 100 };
  assert.equal(valueAtPointer(bounds, 0, 1, "any", 33), 0.33);
  assert.equal(valueAtPointer(bounds, 0, 1, "", 67), 0.67);
});

test("a non-positive width falls back to min", () => {
  assert.equal(valueAtPointer({ left: 100, width: 0 }, 5, 10, "1", 150), 5);
  assert.equal(valueAtPointer({ left: 100, width: -20 }, 5, 10, "1", 150), 5);
});

test("non-finite input does not produce NaN", () => {
  assert.equal(valueAtPointer(box, 3, 7, "1", Number.NaN), 3);
  assert.equal(valueAtPointer({ left: Number.NaN, width: 200 }, 3, 7, "1", 150), 3);
  assert.equal(valueAtPointer(box, Number.NaN, 7, "1", 100), 0);
  assert.equal(valueAtPointer(box, 3, Number.NaN, "1", 200), 3);
});
