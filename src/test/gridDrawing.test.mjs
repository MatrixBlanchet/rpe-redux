/** Event timeline hover guides keep only the horizontal beat guide. */
import assert from "node:assert/strict";
import test from "node:test";
import { shouldDrawEventHoverVertical } from "../frontend/screens/editor/workspace/timeline/drawing/gridDrawing.ts";

/** Minimal viewport shape needed by the hover-guide policy. */
test("event timelines suppress the vertical hover guide in every layout", () => {
  assert.equal(shouldDrawEventHoverVertical("events"), false);
  assert.equal(shouldDrawEventHoverVertical("notes"), true);
});
