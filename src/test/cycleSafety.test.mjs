/** Walkers that receive charts or peer payloads terminate on cyclic data. */
import assert from "node:assert/strict";
import test from "node:test";
import { deepEqual, diffCharts, stableFingerprint } from "../core/collaboration/changes.ts";
import { assertChart, createChart } from "../core/global/chart/chart.ts";
import { containsCycle } from "../core/global/chart/cycles.ts";
import { readRpeHotkeys } from "../core/migration/rpe.ts";

test("a cyclic chart is rejected at the chart boundary", () => {
  const chart = createChart();
  assert.equal(containsCycle(chart), false);
  assert.doesNotThrow(() => assertChart(chart));
  chart.judgeLineList[0].chart = chart;
  assert.equal(containsCycle(chart), true);
  assert.throws(() => assertChart(chart), /cycle|循环/i);
});

test("stableFingerprint hashes a cyclic payload instead of overflowing", () => {
  const value = { name: "chart" };
  value.self = value;
  const first = stableFingerprint(value);
  assert.equal(typeof first, "string");
  assert.equal(stableFingerprint(value), first);
  // A cycle marker is part of the digest, not an exception path.
  assert.equal(stableFingerprint({ name: "chart" }) === first, false);
});

test("deepEqual terminates on cycles and still reports differences", () => {
  const left = { value: 1 };
  left.self = left;
  const right = { value: 1 };
  right.self = right;
  assert.equal(deepEqual(left, right), true);
  right.value = 2;
  assert.equal(deepEqual(left, right), false);
  // A shared subtree that compared unequal is not treated as equal later.
  const shared = { n: 1 };
  const a = { first: shared, second: { n: 1 } };
  const b = { first: shared, second: { n: 2 } };
  assert.equal(deepEqual(a, b), false);
});

test("an overlong Hotkey.txt line is skipped, not reported", () => {
  const report = readRpeHotkeys(["AddTap Q", `AddDrag ${"K".repeat(600)}`].join("\n"));
  assert.equal(report.entries.length, 1);
  assert.equal(report.entries[0].action, "AddTap");
});

test("an oversized Hotkey.txt body is bounded before it is split", () => {
  const body = Array.from({ length: 40000 }, (_, index) => `Add${index} Q`).join("\n");
  assert.ok(body.length > 256 * 1024);
  const report = readRpeHotkeys(body);
  assert.ok(report.entries.length > 0);
  assert.ok(report.entries.length < 40000);
});

test("diffCharts caps a deeply nested or cyclic graph as one change", () => {
  const before = {};
  const after = {};
  let left = before;
  let right = after;
  for (let depth = 0; depth < 200; depth += 1) {
    left.child = {};
    right.child = {};
    left = left.child;
    right = right.child;
  }
  left.value = 1;
  right.value = 2;
  // A back-reference makes both graphs cyclic; the diff still terminates.
  left.self = before;
  right.self = after;
  const changes = diffCharts(before, after);
  assert.ok(changes.length > 0);
  assert.ok(changes.every((change) => typeof change.op === "string"));
});
