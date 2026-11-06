/** Zero-length Holds inherit the line angle instead of falling back to 0. */
import assert from "node:assert/strict";
import test from "node:test";
import { holdRenderRotation } from "../frontend/screens/editor/canvas/noteGeometry.ts";

test("a zero-length Hold uses the line angle", () => {
  assert.equal(holdRenderRotation(100, 100, 100, 100, Math.PI / 2), Math.PI / 2);
});

test("a Hold with a body keeps its head-to-tail axis", () => {
  assert.equal(holdRenderRotation(100, 100, 100, 40, 0), Math.PI);
});
