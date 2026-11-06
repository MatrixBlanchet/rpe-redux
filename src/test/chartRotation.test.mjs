/** Covers RPE's opt-in parent-line rotation inheritance. */
import assert from "node:assert/strict";
import test from "node:test";
import { createChart, createLine, inheritsParentRotation } from "../core/global/chart/chart.ts";
import { convertChartToCurrentVersion } from "../core/global/chart/compatibility.ts";

test("a child line keeps its own angle unless rotateWithFather is true", () => {
  assert.equal(inheritsParentRotation({}), false);
  assert.equal(inheritsParentRotation({ rotateWithFather: false }), false);
  assert.equal(inheritsParentRotation({ rotateWithFather: true }), true);
  assert.equal(inheritsParentRotation({ rotateWithFather: 1 }), true);
  assert.equal(createLine("Line").rotateWithFather, false);
});

test("conversion materializes the non-inheriting default", () => {
  const chart = createChart();
  chart.META.RPEVersion = 162;
  delete chart.judgeLineList[0].rotateWithFather;
  const conversion = convertChartToCurrentVersion(chart);
  assert.equal(conversion.chart.judgeLineList[0].rotateWithFather, false);
});
