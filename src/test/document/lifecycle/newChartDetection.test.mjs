/** The four new-chart answers and the preference each one remembers. */
import assert from "node:assert/strict";
import test from "node:test";
import "../../../core/settings/features/audio.ts";
import { values } from "../../../core/state/values.ts";
import {
  normalizeTimingDetectionPreference,
  newChartDetectionTrigger,
  readTimingDetectionPreference,
  resolveNewChartDetection,
  TIMING_DETECTION_SETTING_KEY,
  writeTimingDetectionPreference,
} from "../../../frontend/screens/editor/workspace/document/lifecycle/newChartDetectionPreference.ts";

test("asking waits for the first audio file before showing the prompt", () => {
  assert.equal(newChartDetectionTrigger("ask"), "ask-after-audio");
  assert.equal(newChartDetectionTrigger("always"), "detect-after-audio");
  assert.equal(newChartDetectionTrigger("never"), "none");
});

test("the two remembered answers become the preference", () => {
  assert.deepEqual(resolveNewChartDetection("ask", "always"), {
    detect: true,
    preference: "always",
  });
  assert.deepEqual(resolveNewChartDetection("ask", "never"), {
    detect: false,
    preference: "never",
  });
});

test("the two one-time answers leave the preference untouched", () => {
  assert.deepEqual(resolveNewChartDetection("always", "once"), {
    detect: true,
    preference: "always",
  });
  assert.deepEqual(resolveNewChartDetection("never", "once"), {
    detect: true,
    preference: "never",
  });
  assert.deepEqual(resolveNewChartDetection("always", "skip"), {
    detect: false,
    preference: "always",
  });
  assert.deepEqual(resolveNewChartDetection("never", "skip"), {
    detect: false,
    preference: "never",
  });
});

test("a remembered preference decides when the prompt is not shown", () => {
  assert.deepEqual(resolveNewChartDetection("always", null), {
    detect: true,
    preference: "always",
  });
  assert.deepEqual(resolveNewChartDetection("never", null), {
    detect: false,
    preference: "never",
  });
  assert.deepEqual(resolveNewChartDetection("ask", null), {
    detect: false,
    preference: "ask",
  });
});

test("malformed stored values fall back to asking", () => {
  assert.equal(normalizeTimingDetectionPreference("always"), "always");
  assert.equal(normalizeTimingDetectionPreference("never"), "never");
  assert.equal(normalizeTimingDetectionPreference("sometimes"), "ask");
  assert.equal(normalizeTimingDetectionPreference(undefined), "ask");
});

test("the settings row owns the value the new-chart prompt writes", () => {
  assert.equal(values.byId.has(TIMING_DETECTION_SETTING_KEY), true);
  writeTimingDetectionPreference("always");
  assert.equal(readTimingDetectionPreference(), "always");
  writeTimingDetectionPreference("never");
  assert.equal(readTimingDetectionPreference(), "never");
  writeTimingDetectionPreference("ask");
  assert.equal(readTimingDetectionPreference(), "ask");
});
