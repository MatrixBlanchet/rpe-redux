/** Checks the curve surface's wheel ownership and its camera zoom mapping. */
import assert from "node:assert/strict";
import test from "node:test";
import {
  applyCurveWheelZoom,
  curveWheelZoom,
} from "../frontend/screens/editor/curveEvents/curveWheel.ts";
import { stageWheelAction } from "../frontend/screens/editor/workspace/timeline/interaction/stageWheelOwnership.ts";

const bounds = { left: 100, top: 50, width: 800, height: 600 };

test("an open curve surface owns the stage wheel", () => {
  assert.equal(
    stageWheelAction({
      freeCamera: false,
      curvePreview: true,
      sampling: false,
      defaultPrevented: false,
    }),
    "camera",
  );
});

test("curve wheel zoom anchors on the pointer relative to the canvas centre", () => {
  const step = curveWheelZoom({
    clientX: 500,
    clientY: 350,
    deltaY: -120,
    bounds,
    overToolDock: false,
  });
  assert.deepEqual(step, { cursorX: 0, cursorY: 0, deltaY: -120 });
});

test("curve wheel applies exactly one zoom step through the camera rule", () => {
  const calls = [];
  const applied = applyCurveWheelZoom(
    {
      clientX: 300,
      clientY: 250,
      deltaY: 240,
      bounds,
      overToolDock: false,
    },
    (cursorX, cursorY, deltaY) => calls.push([cursorX, cursorY, deltaY]),
  );
  assert.equal(applied, true);
  assert.deepEqual(calls, [[-200, -100, 240]]);
});

test("line and page wheel deltas are normalized before zooming", () => {
  assert.deepEqual(
    curveWheelZoom({
      clientX: 500,
      clientY: 350,
      deltaY: -3,
      deltaMode: 1,
      bounds,
      overToolDock: false,
    }),
    { cursorX: 0, cursorY: 0, deltaY: -300 },
  );
  assert.deepEqual(
    curveWheelZoom({
      clientX: 300,
      clientY: 250,
      deltaY: 1,
      deltaMode: 2,
      bounds,
      overToolDock: false,
    }),
    { cursorX: -200, cursorY: -100, deltaY: 100 },
  );
});

test("horizontal, empty, and tool-rail wheels do not zoom the camera", () => {
  const zoom = () => assert.fail("camera zoom must not run");
  assert.equal(
    applyCurveWheelZoom({ clientX: 0, clientY: 0, deltaY: 0, bounds, overToolDock: false }, zoom),
    false,
  );
  assert.equal(
    applyCurveWheelZoom({ clientX: 0, clientY: 0, deltaY: -120, bounds, overToolDock: true }, zoom),
    false,
  );
  assert.equal(
    curveWheelZoom({ clientX: 0, clientY: 0, deltaY: 0, bounds, overToolDock: true }),
    null,
  );
});
