/** Noise lines use a unit square, size tracks, and schema active intervals. */
import assert from "node:assert/strict";
import test from "node:test";
import {
  noiseAreaForLine,
  noiseLineSettings,
  projectNoiseLinesForExport,
  setNoiseLineMode,
  validNoiseLineSettings,
} from "../../../core/global/chart/noise/noiseLine.ts";
import { blockAreaBounds } from "../../../core/global/chart/noise/blockArea.ts";
import { noiseLineSizeAt } from "../../../core/global/chart/noise/noiseLineSize.ts";
import { noiseActiveEvents, chartWithEventLists } from "../../../core/edit/events/eventTracks.ts";
import { sampleNoiseLinePreview } from "../../../core/global/chart/noise/noiseLinePreview.ts";

const beat = (value) => [value, 0, 1];
const event = (start, end, from, to) => ({
  startTime: beat(start),
  endTime: beat(end),
  start: from,
  end: to,
});

function noiseLine(overrides = {}) {
  return {
    Name: "Noise",
    notes: [],
    eventLayers: [],
    ...overrides,
  };
}

test("a new noise line owns a 1x1 square and no default active range", () => {
  const line = setNoiseLineMode(noiseLine(), "normal");
  const settings = noiseLineSettings(line);
  assert.equal(settings?.version, 2);
  assert.deepEqual(settings?.area.bottomLeft, { x: -0.5, y: -0.5 });
  assert.deepEqual(settings?.area.topRight, { x: 0.5, y: 0.5 });
  assert.deepEqual(settings?.area.activeIntervals, []);
  assert.deepEqual(line.extended, undefined);
});

test("an empty father string is treated as no parent", () => {
  const line = { ...setNoiseLineMode(noiseLine(), "normal"), father: "" };
  assert.ok(noiseAreaForLine(line));
});

test("an empty size track exports as an explicit zero size, not RPE's 1x1 fallback", () => {
  const line = setNoiseLineMode(noiseLine(), "normal");
  const area = noiseAreaForLine(line);
  assert.ok(area);
  assert.deepEqual(area.bottomLeft, { x: -0.5, y: -0.5 });
  assert.deepEqual(area.topRight, { x: 0.5, y: 0.5 });
  for (const track of [area.scaleXEvents, area.scaleYEvents]) {
    assert.equal(track.length, 1);
    assert.equal(track[0].start, 0);
    assert.equal(track[0].end, 0);
  }
  assert.deepEqual(area.activeIntervals, []);
});

test("a noise line's scale tracks are exported as sizes without another base", () => {
  const converted = setNoiseLineMode(noiseLine(), "normal");
  const line = {
    ...converted,
    extended: {
      scaleXEvents: [event(0, 2, 120, 240)],
      scaleYEvents: [event(0, 2, 60, 90)],
    },
  };
  const area = noiseAreaForLine(line);
  assert.ok(area);
  assert.deepEqual(
    area.scaleXEvents.map((item) => [item.start, item.end]),
    [[120, 240]],
  );
  assert.deepEqual(
    area.scaleYEvents.map((item) => [item.start, item.end]),
    [[60, 90]],
  );
});

test("converting a standard line starts the size tracks empty", () => {
  const line = noiseLine({
    extended: { scaleXEvents: [event(0, 2, 1, 2)], scaleYEvents: [event(0, 2, 1, 2)] },
  });
  const converted = setNoiseLineMode(line, "normal");
  assert.equal(converted.extended?.scaleXEvents, undefined);
  assert.equal(converted.extended?.scaleYEvents, undefined);
  const exported = noiseAreaForLine(converted);
  assert.equal(exported?.scaleXEvents[0]?.start, 0);
  assert.equal(exported?.scaleXEvents[0]?.end, 0);
});

test("a late size event gets an explicit zero span before it", () => {
  const converted = setNoiseLineMode(noiseLine(), "normal");
  const line = {
    ...converted,
    extended: { scaleXEvents: [event(5, 10, 80, 160)] },
  };
  const area = noiseAreaForLine(line);
  assert.ok(area);
  assert.deepEqual(
    area.scaleXEvents.map((item) => [item.startTime, item.start, item.end]),
    [
      [beat(0), 0, 0],
      [beat(5), 80, 160],
    ],
  );
});

test("turning noise off drops the size tracks instead of scaling the texture", () => {
  const converted = setNoiseLineMode(noiseLine(), "normal");
  const sized = {
    ...converted,
    extended: { scaleXEvents: [event(0, 2, 120, 240)] },
  };
  const off = setNoiseLineMode(sized, "off");
  assert.equal(noiseLineSettings(off), null);
  assert.equal(off.extended?.scaleXEvents, undefined);
});

test("older noise-line settings are ignored instead of migrated", () => {
  const line = noiseLine({
    _reduxNoiseLine: {
      version: 1,
      invert: true,
      activeEvents: [event(1, 3, 1, 1)],
      area: {
        bottomLeft: { x: -250, y: -150 },
        topRight: { x: 250, y: 150 },
        appearTime: beat(0),
        disappearTime: beat(10),
        activeIntervals: [],
      },
    },
  });
  assert.equal(noiseLineSettings(line), null);
  assert.equal(validNoiseLineSettings(line), true);
  const exported = projectNoiseLinesForExport({
    BPMList: [{ bpm: 120, startTime: beat(0) }],
    judgeLineList: [line],
  });
  assert.equal(Object.hasOwn(exported.judgeLineList?.[0] ?? {}, "_reduxNoiseLine"), false);
  assert.equal(exported.blockAreaList?.length ?? 0, 0);
});

test("the active track is a stable interval view and writes intervals back", () => {
  const line = setNoiseLineMode(noiseLine(), "normal");
  const first = noiseActiveEvents(line);
  assert.equal(noiseActiveEvents(line), first);
  assert.deepEqual(
    first.map((item) => [item.start, item.end]),
    [],
  );
  const chart = {
    BPMList: [{ bpm: 120, startTime: beat(0) }],
    judgeLineList: [line],
  };
  const edited = chartWithEventLists(
    chart,
    0,
    0,
    new Map([["noiseActiveEvents", [event(2, 4, 1, 1), event(6, 9, 1, 1)]]]),
  );
  assert.deepEqual(noiseLineSettings(edited.judgeLineList?.[0])?.area.activeIntervals, [
    { startTime: beat(2), endTime: beat(4), readyFlash: 0.5 },
    { startTime: beat(6), endTime: beat(9), readyFlash: 0.5 },
  ]);
});

test("area bounds keep the original centre and corner order", () => {
  const bounds = blockAreaBounds({
    bottomLeft: { x: 2, y: 3 },
    topRight: { x: -2, y: -3 },
  });
  assert.deepEqual(bounds.corners, [
    { x: -2, y: -3 },
    { x: 2, y: -3 },
    { x: 2, y: 3 },
    { x: -2, y: 3 },
  ]);
  assert.equal(bounds.centerX, 0);
  assert.equal(bounds.centerY, 0);
});

test("noise size is zero before the first scale event", () => {
  const track = { sources: [{}], starts: Float64Array.from([2]) };
  assert.equal(noiseLineSizeAt(track, 1.5, 1.999), 0);
  assert.equal(noiseLineSizeAt(track, 1.5, 2), 1.5);
  assert.equal(noiseLineSizeAt({ sources: [], starts: new Float64Array() }, 1.5, 10), 0);
});

test("preview corners collapse at size zero and follow size values", () => {
  const area = {
    bottomLeft: { x: -0.5, y: -0.5 },
    topRight: { x: 0.5, y: 0.5 },
    appearTime: beat(0),
    disappearTime: beat(10),
    activeIntervals: [],
  };
  const state = { x: 100, y: 50, rotation: 0, scaleX: 1, scaleY: 1 };
  const sample = { state: "disabled", activation: 0, points: [], invert: false };
  const collapsed = sampleNoiseLinePreview(area, sample, state, 0, 0, 1);
  assert.ok(collapsed.points.every((point) => point.x === 100 && point.y === 50));
  const sized = sampleNoiseLinePreview(area, sample, state, 40, 20, 1);
  assert.deepEqual(sized.points, [
    { x: 80, y: 40 },
    { x: 120, y: 40 },
    { x: 120, y: 60 },
    { x: 80, y: 60 },
  ]);
});

test("export hides the host line and drops editor-only settings", () => {
  const line = setNoiseLineMode(noiseLine(), "inverted");
  const chart = { BPMList: [{ bpm: 120, startTime: beat(0) }], judgeLineList: [line] };
  const exported = projectNoiseLinesForExport(chart);
  assert.equal(exported.blockAreaList?.length, 1);
  assert.equal(exported.blockAreaList?.[0]?.isInvert, true);
  assert.equal(Object.hasOwn(exported.judgeLineList?.[0] ?? {}, "_reduxNoiseLine"), false);
  assert.equal(exported.judgeLineList?.[0]?.eventLayers?.[0]?.alphaEvents?.[0]?.start, 0);
});
