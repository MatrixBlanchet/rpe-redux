/** The timing dialog's pure confidence and fixed-apply rules. */
import assert from "node:assert/strict";
import test from "node:test";
import { createChart } from "../core/global/chart/chart.ts";
import {
  applyDetectedTiming,
  applyTimingLabelKey,
  confidencePercent,
  isLowConfidence,
  LOW_CONFIDENCE_THRESHOLD,
  parseTimingDraft,
} from "../frontend/screens/editor/workspace/timingDetection/timingDetectionModel.ts";

test("confidence displays as a clamped whole percentage", () => {
  assert.equal(confidencePercent(0), 0);
  assert.equal(confidencePercent(0.874), 87);
  assert.equal(confidencePercent(1), 100);
  assert.equal(confidencePercent(-0.2), 0);
  assert.equal(confidencePercent(1.4), 100);
  assert.equal(confidencePercent(Number.NaN), 0);
});

test("the low-confidence warning starts below 40 percent", () => {
  assert.equal(isLowConfidence(0), true);
  assert.equal(isLowConfidence(0.39), true);
  assert.equal(isLowConfidence(LOW_CONFIDENCE_THRESHOLD), false);
  assert.equal(isLowConfidence(0.87), false);
  assert.equal(isLowConfidence(Number.NaN), true);
});

test("invalid or empty fields do not produce a draft", () => {
  assert.equal(parseTimingDraft("", "0"), null);
  assert.equal(parseTimingDraft("120", ""), null);
  assert.equal(parseTimingDraft("0", "0"), null);
  assert.equal(parseTimingDraft("-120", "0"), null);
  assert.equal(parseTimingDraft("120", "not a number"), null);
  assert.deepEqual(parseTimingDraft("174.02", "-12.5"), { bpm: 174.02, offsetMs: -12.5 });
});

test("applying replaces a multi-BPM chart with one fixed entry", () => {
  const chart = createChart();
  const multi = {
    ...chart,
    BPMList: [
      { bpm: 120, startTime: [0, 0, 1] },
      { bpm: 150, startTime: [16, 0, 1] },
    ],
  };
  const applied = applyDetectedTiming(multi, "174.02", "620.4");
  assert.ok(applied);
  assert.equal(applied.chart.BPMList.length, 1);
  assert.equal(applied.chart.BPMList[0].bpm, 174.02);
  assert.deepEqual(applied.chart.BPMList[0].startTime, [0, 0, 1]);
  assert.equal(applied.chart.META.offset, 620.4);
  assert.equal(applied.seekMs, 620.4);
  assert.equal(applyTimingLabelKey(multi), "editorPanels.timingDetection.replaceAndApply");
  assert.equal(applyTimingLabelKey(chart), "editorPanels.timingDetection.apply");
});

test("an invalid draft leaves the chart unapplied", () => {
  assert.equal(applyDetectedTiming(createChart(), "0", "0"), null);
  assert.equal(applyDetectedTiming(createChart(), "120", ""), null);
});
