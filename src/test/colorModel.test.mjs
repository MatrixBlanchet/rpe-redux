/** Colour swatch value rules: normalization and contrast ink selection. */
import assert from "node:assert/strict";
import test from "node:test";
import { colorInk, normalizeColor } from "../design/components/input/colorModel.ts";

test("normalizes long, short, and invalid colour values", () => {
  assert.equal(normalizeColor("#a1b2c3"), "#A1B2C3");
  assert.equal(normalizeColor(" #abc "), "#AABBCC");
  assert.equal(normalizeColor("not-a-colour"), "#000000");
});

test("picks black ink for light swatches and white ink for dark swatches", () => {
  assert.equal(colorInk("#ffffff"), "dark");
  assert.equal(colorInk("#f5d76e"), "dark");
  assert.equal(colorInk("#000000"), "light");
  assert.equal(colorInk("#1b2b4b"), "light");
});
