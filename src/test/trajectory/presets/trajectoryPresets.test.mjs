/** Verifies stored preset lists keep valid entries when one entry is damaged. */
import assert from "node:assert/strict";
import test from "node:test";
import { parseCurvePresets } from "../../../core/global/chart/trajectory/trajectoryPresets.ts";

/** A minimal preset that passes validation and samples successfully. */
function preset(name) {
  return {
    name,
    parameters: [],
    xExpression: "t",
    yExpression: "t",
  };
}

test("stored presets keep valid entries beside damaged ones", () => {
  const stored = [preset("Good"), { name: "" }, null, { ...preset("Also good"), unknown: true }];
  const parsed = parseCurvePresets(JSON.stringify(stored));

  assert.deepEqual(
    parsed.map((entry) => entry.name),
    ["Good"],
    "only the valid entry survives",
  );
});

test("an unreadable or non-array preset payload falls back to an empty list", () => {
  assert.deepEqual(parseCurvePresets(null), []);
  assert.deepEqual(parseCurvePresets(""), []);
  assert.deepEqual(parseCurvePresets("{"), []);
  assert.deepEqual(parseCurvePresets("{}"), []);
  assert.deepEqual(parseCurvePresets(JSON.stringify([preset("One")])).length, 1);
});
