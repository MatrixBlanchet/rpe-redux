/**
 * Event cut density is a multiple of the current beat-line count: with four
 * lines per beat, a density of two cuts the event into eight parts.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { cutEventParts } from "../../../core/edit/events/eventTools.ts";
import { fromNumber } from "../../../core/global/chart/timing/beat.ts";

const event = {
  startTime: fromNumber(0),
  endTime: fromNumber(1),
  start: 0,
  end: 1,
  easingType: 1,
  bezier: 0,
  bezierPoints: [0, 0, 1, 1],
  linkgroup: 0,
  inst: 0,
};

test("cut density multiplies the current beat-line count", () => {
  const doubled = cutEventParts("moveXEvents", event, { division: 4, density: 2 });
  assert.equal(doubled?.length, 8);
  const quadrupled = cutEventParts("moveXEvents", event, { division: 4, density: 4 });
  assert.equal(quadrupled?.length, 16);
});
