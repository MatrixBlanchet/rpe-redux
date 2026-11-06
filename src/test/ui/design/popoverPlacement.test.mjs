/** Anchored-popover geometry: start, centre, and right-edge alignment clamping. */
import assert from "node:assert/strict";
import test from "node:test";
import { POPOVER_EDGE, resolvePopoverLeft } from "../../../design/patterns/useAnchoredPopover.ts";

test("end alignment puts the measured panel's right edge on the anchor's right edge", () => {
  // A 304px menu under a trigger whose right edge is at 1360px.
  assert.equal(resolvePopoverLeft(1360, 304, 1440, "end"), 1056);
  assert.equal(1056 + 304, 1360);
});

test("end alignment keeps the viewport edge gap when the anchor is flush right", () => {
  const left = resolvePopoverLeft(1436, 304, 1440, "end");
  assert.equal(left, 1440 - 304 - POPOVER_EDGE);
  assert.equal(left + 304, 1432);
});

test("end alignment still clamps a menu that would cross the left edge", () => {
  assert.equal(resolvePopoverLeft(100, 304, 1440, "end"), POPOVER_EDGE);
});

test("start and centre align to their own baselines", () => {
  assert.equal(resolvePopoverLeft(200, 304, 1440, "start"), 200);
  assert.equal(resolvePopoverLeft(200, 304, 1440), 200);
  assert.equal(resolvePopoverLeft(720, 304, 1440, "center"), 568);
});

test("start alignment clamps at the right edge instead of overflowing", () => {
  assert.equal(resolvePopoverLeft(1400, 304, 1440, "start"), 1440 - 304 - POPOVER_EDGE);
});
