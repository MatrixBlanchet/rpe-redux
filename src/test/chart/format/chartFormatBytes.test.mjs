/**
 * Locks the exchange exporters to the fixture chart's baseline bytes.
 *
 * The official and PEC writers sample the runtime, so shared chart defaults must
 * not change their serialized output. Each expectation is the complete file
 * text, not a parsed projection, so field order and numeric formatting count.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  COMPATIBILITY_LINE_Z_ORDER,
  CREATED_LINE_Z_ORDER,
  CURRENT_RPE_VERSION,
  DEFAULT_BEZIER_POINTS,
  NO_LINE_PARENT,
  assertChart,
  createChart,
  createEvent,
  createLine,
  importedLineZOrder,
  lineParentIndex,
  parseChart,
} from "../../../core/global/chart/chart.ts";
import { CONTROL_TRACKS } from "../../../core/global/chart/chartTracks.ts";
import { collectChartDiagnostics } from "../../../core/global/chart/diagnostics.ts";
import { convertChartToCurrentVersion } from "../../../core/global/chart/compatibility.ts";
import { projectChartForExport } from "../../../core/global/chart/exportProjection.ts";
import {
  emptyLayer,
  makeEvent,
  makeLine,
  makeMeta,
} from "../../../core/global/chart/formats/common.ts";
import {
  serializeOfficialChart,
  parseOfficialChart,
} from "../../../core/global/chart/formats/official.ts";
import { parsePecChart, serializePecChart } from "../../../core/global/chart/formats/pec.ts";
import { lineHasParent } from "../../../core/global/chart/optionalFeatures.ts";
import { SceneRuntime } from "../../../core/global/chart/runtime/scene.ts";
import { TempoMap } from "../../../core/global/chart/timing/tempo.ts";

const readFixture = (name) =>
  readFileSync(new URL(`../../fixtures/${name}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");

test("official export of the fixture matches its baseline bytes", () => {
  const chart = parseChart(readFixture("smoke.json"));
  const exported = serializeOfficialChart(chart);
  assert.deepEqual(exported.warnings, []);
  assert.equal(exported.text, readFixture("smoke.official.json"));
});

test("PEC export of the fixture matches its baseline bytes", () => {
  const chart = parseChart(readFixture("smoke.json"));
  const exported = serializePecChart(chart);
  assert.deepEqual(exported.warnings, []);
  assert.equal(exported.text, readFixture("smoke.pec.txt"));
});

test("new and imported chart metadata use CURRENT_RPE_VERSION", () => {
  assert.equal(createChart().META.RPEVersion, CURRENT_RPE_VERSION);
  assert.equal(makeMeta({}, 0).RPEVersion, CURRENT_RPE_VERSION);

  const official = parseOfficialChart({
    formatVersion: 3,
    judgeLineList: [{ bpm: 120 }],
  });
  assert.equal(official.chart.META.RPEVersion, CURRENT_RPE_VERSION);

  const pec = parsePecChart("175\nbp 0 120\n");
  assert.equal(pec.chart.META.RPEVersion, CURRENT_RPE_VERSION);
});

test("working-chart event defaults use the identity bezier curve", () => {
  assert.deepEqual(DEFAULT_BEZIER_POINTS, [0, 0, 1, 1]);
  assert.deepEqual(createEvent().bezierPoints, DEFAULT_BEZIER_POINTS);
  assert.deepEqual(makeEvent(0, 1, 0, 1).bezierPoints, DEFAULT_BEZIER_POINTS);
});

test("line zOrder follows its creation, import and compatibility rule", () => {
  assert.equal(CREATED_LINE_Z_ORDER, 0);
  assert.equal(COMPATIBILITY_LINE_Z_ORDER, 0);
  assert.equal(importedLineZOrder(7), 7);
  assert.equal(createLine("New").zOrder, CREATED_LINE_Z_ORDER);
  assert.equal(makeLine("Imported", 7, emptyLayer()).zOrder, importedLineZOrder(7));

  const imported = parseOfficialChart({
    formatVersion: 3,
    judgeLineList: [{ bpm: 120 }, { bpm: 120 }],
  });
  assert.deepEqual(
    imported.chart.judgeLineList.map((line) => line.zOrder),
    [0, 1],
  );

  const conversion = convertChartToCurrentVersion({
    META: { RPEVersion: CURRENT_RPE_VERSION - 1 },
    BPMList: [{ bpm: 120, startTime: [0, 0, 1] }],
    judgeLineList: [{ Name: "Legacy" }],
  });
  assert.equal(conversion.chart.judgeLineList[0].zOrder, COMPATIBILITY_LINE_Z_ORDER);
  assert.equal(conversion.chart.judgeLineList[0].father, NO_LINE_PARENT);
});

test("control tracks keep RPE order and neutral values", () => {
  assert.deepEqual(
    CONTROL_TRACKS.map(({ field, property, neutral }) => [field, property, neutral]),
    [
      ["alphaControl", "alpha", 1],
      ["posControl", "pos", 1],
      ["sizeControl", "size", 1],
      ["skewControl", "skew", 0],
      ["yControl", "y", 1],
    ],
  );
});

test("validation, diagnostics and export accept every catalogued control track", () => {
  const line = createLine("Controlled");
  for (const { field, property, neutral } of CONTROL_TRACKS) {
    line[field] = [{ x: 0, [property]: neutral, easing: 1 }];
  }
  const chart = createChart();
  chart.judgeLineList = [line];

  assert.doesNotThrow(() => assertChart(chart));
  assert.deepEqual(collectChartDiagnostics(chart), []);
  const projectedLine = projectChartForExport(chart, "controlled").judgeLineList[0];
  for (const { field } of CONTROL_TRACKS) {
    assert.deepEqual(projectedLine[field], line[field]);
  }
});

test("parent normalization maps every root spelling to the same sentinel", () => {
  for (const value of [undefined, null, "", -1]) {
    assert.equal(lineParentIndex(value), NO_LINE_PARENT);
  }
  assert.equal(lineParentIndex(0), 0);
  assert.equal(lineParentIndex("3"), 3);
  assert.ok(Number.isNaN(lineParentIndex("parent")));

  assert.equal(lineHasParent({ father: 0 }), true);
  assert.equal(lineHasParent({ father: "0" }), true);
  assert.equal(lineHasParent({ father: -1 }), false);
  assert.equal(lineHasParent({ father: "" }), false);
  assert.equal(lineHasParent({}), false);
});

test("the scene resolves numeric-string parents through the shared normalization", () => {
  const chart = createChart();
  const parent = createLine("Parent");
  parent.eventLayers[0].moveXEvents = [
    { ...parent.eventLayers[0].moveXEvents[0], start: 100, end: 100 },
  ];
  const child = createLine("Child");
  child.father = "0";
  chart.judgeLineList = [parent, child];

  const scene = new SceneRuntime();
  scene.compile(chart, new TempoMap(chart.BPMList));
  assert.equal(scene.sample(0)[1].x, 100);
});
