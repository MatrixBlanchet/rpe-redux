/** Beat-line color roles stay aligned with the settings table and its defaults. */
import assert from "node:assert/strict";
import test from "node:test";
import { TIMELINE_GRID_COLORS } from "../../../core/settings/timelineGridColors.ts";
import {
  BEAT_LINE_COLOR_KEYS,
  beatLineColorKeys,
} from "../../../frontend/screens/editor/canvas/beatLineColors.ts";

test("the settings table and canvas roles share one denominator order", () => {
  const settingsKeys = TIMELINE_GRID_COLORS.map(([denominator]) => denominator);
  assert.deepEqual(settingsKeys, [...BEAT_LINE_COLOR_KEYS]);
});

test("the half-beat row owns its red default", () => {
  assert.deepEqual(
    TIMELINE_GRID_COLORS.find(([denominator]) => denominator === "2"),
    ["2", "#ed1121", "settings.field.timeline-grid-color-2.label"],
  );
});

test("the half-beat role lands on the middle subdivision", () => {
  assert.equal(beatLineColorKeys(4)[2], "2");
  assert.equal(beatLineColorKeys(8)[4], "2");
  assert.equal(beatLineColorKeys(12)[6], "2");
  assert.equal(beatLineColorKeys(12)[4], "3");
  assert.equal(beatLineColorKeys(12)[11], "12");
});
