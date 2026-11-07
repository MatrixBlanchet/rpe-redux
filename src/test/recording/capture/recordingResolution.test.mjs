/**
 * Render-ratio presets: exact ratios, encoder-safe dimensions, the closest-tier
 * rule used when the ratio changes, and the custom width/height path.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  closestRecordingResolution,
  parseRecordingResolution,
  RECORDING_RATIOS,
  RECORDING_RESOLUTIONS,
  recordingDimensions,
} from "../../../frontend/screens/editor/workspace/recording/recordingResolution.ts";

test("every preset matches its ratio and the encoder bounds", () => {
  for (const [ratio, presets] of Object.entries(RECORDING_RESOLUTIONS)) {
    const [ratioWidth, ratioHeight] = ratio.split(":").map(Number);
    assert.ok(presets.length >= 2, `${ratio} has too few presets`);
    for (const preset of presets) {
      const parsed = parseRecordingResolution(preset);
      assert.ok(parsed, `${ratio} preset ${preset} is not widthxheight`);
      assert.equal(
        parsed.width * ratioHeight,
        parsed.height * ratioWidth,
        `${preset} is not ${ratio}`,
      );
      assert.equal(parsed.width % 2, 0, `${preset} width is odd`);
      assert.equal(parsed.height % 2, 0, `${preset} height is odd`);
      assert.ok(parsed.width >= 2 && parsed.width <= 3840, `${preset} width is out of range`);
      assert.ok(parsed.height >= 2 && parsed.height <= 2160, `${preset} height is out of range`);
    }
  }
});

test("the ratio list exposes every fixed table plus custom", () => {
  assert.deepEqual(
    RECORDING_RATIOS.filter((ratio) => ratio !== "custom"),
    Object.keys(RECORDING_RESOLUTIONS),
  );
  assert.ok(RECORDING_RATIOS.includes("custom"));
});

test("a ratio change keeps the closest output area", () => {
  assert.equal(closestRecordingResolution("4:3", { width: 1920, height: 1080 }), "1440x1080");
  assert.equal(closestRecordingResolution("3:2", { width: 1920, height: 1080 }), "1620x1080");
  assert.equal(closestRecordingResolution("4:3", { width: 3840, height: 2160 }), "2880x2160");
  assert.equal(closestRecordingResolution("16:9", { width: 1440, height: 1080 }), "1920x1080");
  assert.equal(closestRecordingResolution("16:9", { width: 1280, height: 720 }), "1280x720");
});

test("invalid dimensions fall back to the ratio's 1080p tier", () => {
  assert.equal(closestRecordingResolution("16:9", { width: 0, height: 0 }), "1920x1080");
  assert.equal(closestRecordingResolution("3:2", { width: NaN, height: 1080 }), "1620x1080");
  assert.equal(closestRecordingResolution("4:3", { width: 1440, height: 0 }), "1440x1080");
});

test("a fixed ratio reads the selected preset", () => {
  assert.deepEqual(recordingDimensions("16:9", "2560x1440", "", ""), {
    width: 2560,
    height: 1440,
  });
  assert.deepEqual(recordingDimensions("4:3", "960x720", "", ""), { width: 960, height: 720 });
});

test("a stale preset falls back inside the new ratio", () => {
  assert.deepEqual(recordingDimensions("4:3", "1920x1080", "", ""), {
    width: 1440,
    height: 1080,
  });
});

test("the custom ratio reads the text fields", () => {
  assert.deepEqual(recordingDimensions("custom", "1920x1080", "1080", "1920"), {
    width: 1080,
    height: 1920,
  });
  assert.deepEqual(recordingDimensions("custom", "1920x1080", "", ""), { width: 0, height: 0 });
});
