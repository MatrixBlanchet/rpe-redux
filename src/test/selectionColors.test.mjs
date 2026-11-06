import assert from "node:assert/strict";
import test from "node:test";
import "../core/settings/features/index.ts";
import { values } from "../core/state/values.ts";
import {
  rgbChannels,
  selectionColor,
  selectionHighlightColor,
} from "../frontend/screens/editor/canvas/palette.ts";

test("selection colors use the configured defaults and accept changed values", () => {
  assert.deepEqual(rgbChannels(selectionColor("timeline-event-marquee-color", "")), [100, 75, 80]);
  assert.deepEqual(rgbChannels(selectionColor("timeline-note-marquee-color", "")), [0, 100, 0]);
  assert.deepEqual(
    selectionHighlightColor({
      selectionHighlightStroke: selectionColor("selected-note-color", ""),
    }),
    [0, 200, 0],
  );
  const original = values.byId.get("selected-note-color");
  try {
    values.byId.set("selected-note-color", "#123456");
    assert.deepEqual(rgbChannels(selectionColor("selected-note-color", "")), [18, 52, 86]);
  } finally {
    values.byId.set("selected-note-color", original);
  }
});
