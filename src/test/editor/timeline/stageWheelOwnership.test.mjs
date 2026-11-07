/** Checks which surface owns a wheel event over the editor stage. */
import assert from "node:assert/strict";
import test from "node:test";
import { stageWheelAction } from "../../../frontend/screens/editor/workspace/timeline/interaction/stageWheelOwnership.ts";

const idle = {
  freeCamera: false,
  curvePreview: false,
  sampling: false,
  defaultPrevented: false,
};

test("a plain stage wheel belongs to the timeline", () => {
  assert.equal(stageWheelAction(idle), "timeline");
});

for (const owner of ["freeCamera", "curvePreview", "sampling"]) {
  test(`${owner} alone owns the wheel`, () => {
    assert.equal(stageWheelAction({ ...idle, [owner]: true }), "camera");
  });
}

test("an already prevented wheel never reaches the timeline", () => {
  assert.equal(stageWheelAction({ ...idle, defaultPrevented: true }), "camera");
});

test("combined camera surfaces still own the wheel", () => {
  assert.equal(
    stageWheelAction({
      freeCamera: true,
      curvePreview: true,
      sampling: true,
      defaultPrevented: false,
    }),
    "camera",
  );
  assert.equal(
    stageWheelAction({
      freeCamera: false,
      curvePreview: true,
      sampling: false,
      defaultPrevented: true,
    }),
    "camera",
  );
});
