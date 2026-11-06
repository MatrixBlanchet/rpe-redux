/** Recording bitrate resolution and the inspector's size estimate stay predictable. */
import assert from "node:assert/strict";
import test from "node:test";
import {
  AUTO_VIDEO_BITRATE,
  RECORDING_AUDIO_BPS,
  estimateRecording,
  estimateRecordingBytes,
  resolveVideoBitrateMbps,
} from "../frontend/screens/editor/workspace/recording/recordingEstimate.ts";

test("a manual bitrate is used unchanged", () => {
  assert.equal(resolveVideoBitrateMbps(1920, 1080, 60, 20), 20);
});

test("auto bitrate follows the output geometry", () => {
  assert.equal(resolveVideoBitrateMbps(1920, 1080, 60, AUTO_VIDEO_BITRATE), 12);
  assert.equal(resolveVideoBitrateMbps(1280, 720, 30, AUTO_VIDEO_BITRATE), 3);
  assert.equal(resolveVideoBitrateMbps(3840, 2160, 120, AUTO_VIDEO_BITRATE), 100);
  assert.equal(resolveVideoBitrateMbps(2, 2, 1, AUTO_VIDEO_BITRATE), 1);
});

test("invalid manual bitrates have no estimate", () => {
  for (const value of [0, -2, 101, 12.5, Number.NaN]) {
    assert.ok(Number.isNaN(resolveVideoBitrateMbps(1920, 1080, 60, value)));
  }
});

test("the estimate includes the AAC track and container overhead", () => {
  const bytes = estimateRecordingBytes({
    width: 1920,
    height: 1080,
    fps: 60,
    videoBitrate: 10,
    seconds: 60,
  });
  const expected = Math.round((((10_000_000 + RECORDING_AUDIO_BPS) * 60) / 8) * 1.02);
  assert.equal(bytes, expected);
});

test("speed shortens the output duration and halves the estimate", () => {
  const base = {
    width: 1920,
    height: 1080,
    fps: 60,
    videoBitrate: 10,
    seconds: 60,
  };
  const normal = estimateRecordingBytes(base);
  const fast = estimateRecording({ ...base, speed: 2 });
  assert.equal(fast.outputSeconds, 30);
  assert.equal(fast.bytes, normal / 2);
  assert.equal(estimateRecordingBytes({ ...base, speed: 2 }), normal / 2);

  const gif = { ...base, format: "gif", fps: 30, seconds: 20 };
  assert.equal(estimateRecordingBytes({ ...gif, speed: 2 }), estimateRecordingBytes(gif) / 2);
});

test("invalid speeds have no estimate", () => {
  for (const speed of [0.49, 4.01, 0, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.deepEqual(
      estimateRecording({
        width: 1920,
        height: 1080,
        fps: 60,
        videoBitrate: 10,
        seconds: 60,
        speed,
      }),
      { bytes: 0, outputSeconds: 0 },
    );
  }
});

test("an empty interval has no estimate", () => {
  assert.equal(
    estimateRecordingBytes({
      width: 1920,
      height: 1080,
      fps: 60,
      videoBitrate: 10,
      seconds: 0,
    }),
    0,
  );
});
