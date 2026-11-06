/** Judge-line purpose traits keep meaningless authoring fields out of the panel. */
import assert from "node:assert/strict";
import test from "node:test";
import {
  combineJudgeLineTraits,
  judgeLineTraits,
  lineAllowsNotes,
} from "../core/global/chart/line/lineTraits.ts";

function noiseLine(invert = false) {
  return {
    Name: "Noise",
    notes: [],
    eventLayers: [],
    _reduxNoiseLine: {
      version: 2,
      invert,
      area: {
        bottomLeft: { x: -0.5, y: -0.5 },
        topRight: { x: 0.5, y: 0.5 },
        appearTime: [0, 0, 1],
        disappearTime: [1, 0, 1],
        activeIntervals: [],
      },
    },
  };
}

test("standard lines keep every playable authoring field", () => {
  const traits = judgeLineTraits({ Name: "Line", notes: [], eventLayers: [] });
  assert.equal(traits.purpose, "standard");
  assert.equal(traits.allowsNotes, true);
  assert.equal(traits.allowsTexture, true);
  assert.equal(traits.allowsAnchor, false);
  assert.equal(traits.allowsNoiseMode, true);
});

test("custom textures are storyboard lines, not playable judge lines", () => {
  const traits = judgeLineTraits({
    Name: "Storyboard",
    Texture: "cover.png",
    notes: [],
    eventLayers: [],
  });
  assert.equal(traits.purpose, "texture");
  assert.equal(traits.isTexture, true);
  assert.equal(traits.allowsNotes, false);
  assert.equal(traits.allowsTexture, true);
  assert.equal(traits.allowsAnchor, true);
  assert.equal(traits.allowsMask, false);
  assert.equal(traits.allowsSpeedEvents, false);
  assert.equal(traits.allowsZOrder, true);
  assert.equal(traits.allowsNoiseMode, false);
});

test("noise lines drop note, alpha, speed, texture, mask and UI fields", () => {
  const traits = judgeLineTraits(noiseLine(true));
  assert.equal(traits.purpose, "noise");
  assert.equal(traits.noiseInverted, true);
  assert.equal(traits.allowsNotes, false);
  assert.equal(traits.allowsAlphaEvents, false);
  assert.equal(traits.allowsSpeedEvents, false);
  assert.equal(traits.allowsTexture, false);
  assert.equal(traits.allowsMask, false);
  assert.equal(traits.allowsUiBinding, false);
  assert.equal(traits.allowsNoiseMode, true);
});

test("UI bindings keep transforms and alpha but not playable content", () => {
  const traits = judgeLineTraits({ Name: "Score", attachUI: "score", notes: [], eventLayers: [] });
  assert.equal(traits.purpose, "ui");
  assert.equal(traits.allowsNotes, false);
  assert.equal(traits.allowsAlphaEvents, true);
  assert.equal(traits.allowsSpeedEvents, false);
  assert.equal(traits.allowsTexture, false);
  assert.equal(traits.allowsUiBinding, true);
  assert.equal(traits.allowsNoiseMode, false);
});

test("text lines are labels, not texture or note surfaces", () => {
  const traits = judgeLineTraits({
    Name: "Label",
    notes: [],
    eventLayers: [],
    extended: {
      textEvents: [{ startTime: [0, 0, 1], endTime: [1, 0, 1], start: "Hi", end: "Hi" }],
    },
  });
  assert.equal(traits.purpose, "text");
  assert.equal(traits.allowsNotes, false);
  assert.equal(traits.allowsTexture, false);
  assert.equal(traits.allowsMask, false);
  assert.equal(traits.allowsZOrder, true);
});

test("batch traits show a field only when every selected line keeps it", () => {
  const traits = combineJudgeLineTraits([
    { Name: "Line", notes: [], eventLayers: [] },
    noiseLine(),
  ]);
  assert.equal(traits.allowsTexture, false);
  assert.equal(traits.allowsNotes, false);
  assert.equal(traits.allowsUiBinding, false);
  assert.equal(lineAllowsNotes(noiseLine()), false);
});
