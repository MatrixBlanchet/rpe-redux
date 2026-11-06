/**
 * Verifies equation drafts keep their last valid path but report when the
 * current expressions cannot be sampled.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  curvePreviewState,
  updateCurveEquation,
  updateCurvePreview,
} from "../../../frontend/screens/editor/curveEvents/store.ts";

const valid = {
  xExpression: "-420+840*t",
  yExpression: "220*sin(2*pi*t)",
  parameterStart: "0",
  parameterEnd: "1",
};

test("an invalid equation keeps the last path and blocks generation", () => {
  updateCurvePreview({
    editMode: "equation",
    equation: { ...valid, component: null },
    equationInvalid: false,
  });
  updateCurveEquation(valid);
  const component = curvePreviewState.get().equation.component;
  assert.ok(component, "a valid equation creates a path");
  assert.equal(curvePreviewState.get().equationInvalid, false);

  updateCurveEquation({ xExpression: "not a function" });
  assert.equal(
    curvePreviewState.get().equation.component,
    component,
    "the previous path stays visible while the expression is invalid",
  );
  assert.equal(curvePreviewState.get().equationInvalid, true);

  updateCurveEquation({ xExpression: "t" });
  assert.equal(
    curvePreviewState.get().equationInvalid,
    false,
    "fixing the equation clears the flag",
  );
});

test("clearing both expressions clears the path and the invalid flag", () => {
  updateCurvePreview({
    equation: { ...valid, component: null },
    equationInvalid: true,
  });
  updateCurveEquation({ xExpression: "", yExpression: "" });
  const state = curvePreviewState.get();
  assert.equal(state.equation.component, null);
  assert.equal(state.equationInvalid, false);
});
