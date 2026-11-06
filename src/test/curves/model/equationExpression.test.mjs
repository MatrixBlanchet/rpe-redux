/**
 * Verifies the expression syntax shared by curve equations: implicit
 * multiplication, common functions and constants, input normalization, and the
 * display tokenizer used by the equation editor.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { compileExpression } from "../../../core/utils/batchScript.ts";
import {
  normalizeCurveExpression,
  sampleCurveTrajectory,
} from "../../../core/global/chart/trajectory/curveTrajectory.ts";
import { tokenizeEquation } from "../../../frontend/screens/editor/curveEvents/equationSyntax.ts";

const scope = { t: 2, u: 0.5, theta: 1, seed: 0, randomness: 0 };

test("implicit multiplication works beside numbers, variables, and parentheses", () => {
  assert.equal(compileExpression("2t")(scope), 4);
  assert.equal(compileExpression("2(t+1)")(scope), 6);
  assert.equal(compileExpression("(t+1)(t-1)")(scope), 3);
  assert.equal(compileExpression("2pi")(scope), Math.PI * 2);
  assert.equal(compileExpression("2^3t")(scope), 16);
});

test("common functions and constants resolve in equation expressions", () => {
  assert.equal(compileExpression("2sin(pi/2)")(scope), 2);
  assert.equal(compileExpression("SIN(pi/2)")(scope), 1);
  assert.equal(compileExpression("ln(e)")(scope), 1);
  assert.equal(compileExpression("log(100)")(scope), 2);
  assert.equal(compileExpression("log(8,2)")(scope), 3);
  assert.equal(compileExpression("sign(-2)")(scope), -1);
  assert.equal(compileExpression("mod(7,4)")(scope), 3);
  assert.equal(compileExpression("tau")(scope), Math.PI * 2);
});

test("theta is available as normalized progress in parametric mode", () => {
  const samples = sampleCurveTrajectory(
    {
      mode: "parametric",
      xExpression: "theta*100",
      yExpression: "0",
      parameterStart: "0",
      parameterEnd: "1",
    },
    3,
  );
  assert.deepEqual(
    samples.map((sample) => sample.x),
    [0, 50, 100],
  );
});

test("author-typed symbols normalize to the evaluator spelling", () => {
  assert.equal(normalizeCurveExpression("π×2"), "pi*2");
  assert.equal(normalizeCurveExpression("2²+√4"), "2^2+sqrt(4)");
  assert.equal(normalizeCurveExpression("（t＋1）÷2"), "(t+1)/2");
  assert.equal(normalizeCurveExpression("−θ"), "-theta");
  assert.equal(normalizeCurveExpression("2≤t"), "2<=t");
});

test("display tokens distinguish functions, variables, constants, and operators", () => {
  const tokens = tokenizeEquation("2t+sin(pi)").filter((token) => token.kind !== "space");
  assert.deepEqual(
    tokens.map((token) => [token.text, token.kind]),
    [
      ["2", "number"],
      ["t", "variable"],
      ["+", "operator"],
      ["sin", "function"],
      ["(", "punctuation"],
      ["pi", "constant"],
      [")", "punctuation"],
    ],
  );
  assert.equal(tokenizeEquation("foo(t)")[0].kind, "invalid");
  assert.deepEqual(
    tokenizeEquation("θ×2")
      .filter((token) => token.kind !== "space")
      .map((token) => token.kind),
    ["variable", "operator", "number"],
  );
});
