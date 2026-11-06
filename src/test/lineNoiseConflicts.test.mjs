/** Clearing a line's playable content also removes its custom noise-incompatible texture. */
import assert from "node:assert/strict";
import test from "node:test";
import {
  clearLineNoiseConflicts,
  lineNoiseConflicts,
} from "../core/global/chart/noise/lineNoiseConflicts.ts";
import { setNoiseLineMode } from "../core/global/chart/noise/noiseLine.ts";

test("noise conversion clears notes, opacity, speed and custom textures", () => {
  const line = {
    Name: "Line",
    Texture: "cover.png",
    notes: [{ id: "note" }],
    numOfNotes: 1,
    eventLayers: [
      {
        alphaEvents: [{ startTime: [0, 0, 1], endTime: [1, 0, 1], start: 255, end: 255 }],
        speedEvents: [{ startTime: [0, 0, 1], endTime: [1, 0, 1], start: 1, end: 1 }],
      },
    ],
  };
  assert.deepEqual(lineNoiseConflicts(line), {
    notes: 1,
    alphaEvents: 1,
    speedEvents: 1,
    textures: 1,
  });
  const cleared = clearLineNoiseConflicts(line);
  assert.equal(cleared.Texture, "line.png");
  assert.deepEqual(cleared.notes, []);
  assert.equal(cleared.numOfNotes, 0);
  assert.equal(cleared.eventLayers?.[0]?.alphaEvents?.length, 0);
  assert.equal(cleared.eventLayers?.[0]?.speedEvents?.length, 0);
});

test("a default line texture is not a noise conflict", () => {
  assert.equal(lineNoiseConflicts({ Name: "Line", Texture: "line.png" }).textures, 0);
  assert.equal(lineNoiseConflicts({ Name: "Line" }).textures, 0);
});

test("enabling noise refuses a custom texture until it is cleared", () => {
  const line = { Name: "Line", Texture: "cover.png", notes: [], eventLayers: [] };
  assert.throws(() => setNoiseLineMode(line, "normal"));
  const converted = setNoiseLineMode(line, "normal", true);
  assert.equal(converted.Texture, "line.png");
  assert.equal(converted._reduxNoiseLine?.invert, false);
});
