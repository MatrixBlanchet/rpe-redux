/** Folder purpose edits: conflicts, skips, and immutability of the input chart. */
import assert from "node:assert/strict";
import test from "node:test";
import { applyLinePurpose } from "../core/global/chart/line/linePurposeEdits.ts";
import { noiseLineSettings } from "../core/global/chart/noise/noiseLine.ts";

/** A minimal chart with one declared folder. */
function chartWith(lines) {
  return {
    META: { name: "Purpose fixture" },
    BPMList: [{ bpm: 120, startTime: [0, 0, 1] }],
    judgeLineGroup: ["Default"],
    judgeLineList: lines,
  };
}

/** A standard line with a default texture and an empty event layer. */
function line(overrides = {}) {
  return { Name: "Line", Texture: "line.png", notes: [], eventLayers: [{}], ...overrides };
}

/** One tap note at beat 0. */
function note() {
  return { startTime: [0, 0, 1], endTime: [1, 0, 1], start: 0, end: 0, type: 1 };
}

/** One transform event at beat 0. */
function event() {
  return { startTime: [0, 0, 1], endTime: [1, 0, 1], start: 0, end: 0 };
}

/** A valid version 2 noise-area payload. */
function noise(invert = false) {
  return {
    version: 2,
    invert,
    area: {
      bottomLeft: { x: -0.5, y: -0.5 },
      topRight: { x: 0.5, y: 0.5 },
      appearTime: [0, 0, 1],
      disappearTime: [4, 0, 1],
      activeIntervals: [],
    },
  };
}

test("standard clears noise, custom texture, and UI binding without touching notes", () => {
  const chart = chartWith([
    line({
      _reduxNoiseLine: noise(),
      Texture: "cover.png",
      attachUI: "score",
      notes: [note()],
    }),
  ]);
  const before = structuredClone(chart);
  const result = applyLinePurpose(chart, [0], "standard");
  const next = result.chart.judgeLineList[0];
  assert.deepEqual(result.changed, [0]);
  assert.equal(next._reduxNoiseLine, undefined);
  assert.equal(next.Texture, "line.png");
  assert.equal(next.attachUI, undefined);
  assert.equal(next.notes.length, 1);
  assert.deepEqual(result.conflicts, {
    lines: 1,
    notes: 0,
    alphaEvents: 0,
    speedEvents: 0,
    textures: 1,
    uiBindings: 1,
    noiseSettings: 1,
  });
  assert.notEqual(result.chart, chart);
  assert.deepEqual(chart, before);
});

test("noise clears notes, opacity and speed events, and custom textures", () => {
  const chart = chartWith([
    line({
      Texture: "cover.png",
      notes: [note(), note()],
      eventLayers: [{ alphaEvents: [event()], speedEvents: [event()] }],
    }),
  ]);
  const result = applyLinePurpose(chart, [0], "noise");
  const next = result.chart.judgeLineList[0];
  assert.deepEqual(result.changed, [0]);
  assert.equal(next.notes.length, 0);
  assert.equal(next.numOfNotes, 0);
  assert.equal(next.Texture, "line.png");
  assert.equal(next.eventLayers[0].alphaEvents.length, 0);
  assert.equal(next.eventLayers[0].speedEvents.length, 0);
  assert.equal(noiseLineSettings(next)?.invert, false);
  assert.deepEqual(result.conflicts, {
    lines: 1,
    notes: 2,
    alphaEvents: 1,
    speedEvents: 1,
    textures: 1,
    uiBindings: 0,
    noiseSettings: 0,
  });
});

test("inverted noise sets the invert flag", () => {
  const chart = chartWith([line()]);
  const result = applyLinePurpose(chart, [0], "inverted");
  assert.deepEqual(result.changed, [0]);
  assert.equal(noiseLineSettings(result.chart.judgeLineList[0])?.invert, true);
  assert.equal(result.conflicts.lines, 0);
});

test("an existing noise line in the target mode is not rewritten", () => {
  const chart = chartWith([line({ _reduxNoiseLine: noise(true) })]);
  const result = applyLinePurpose(chart, [0], "inverted");
  assert.deepEqual(result.changed, []);
  assert.equal(result.chart, chart);
});

test("text lines are skipped and reported", () => {
  const chart = chartWith([
    line({ extended: { textEvents: [event()] } }),
    line({ notes: [note()] }),
  ]);
  const result = applyLinePurpose(chart, [0, 1], "noise");
  assert.deepEqual(result.changed, [1]);
  assert.deepEqual(result.skipped, [{ index: 0, reason: "text" }]);
  assert.equal(result.chart.judgeLineList[0], chart.judgeLineList[0]);
  assert.equal(result.conflicts.notes, 1);
});

test("out-of-range, duplicate, and non-integer indices are ignored", () => {
  const chart = chartWith([line({ Texture: "cover.png" })]);
  const result = applyLinePurpose(chart, [-1, 0, 0, 1, 1.5], "standard");
  assert.deepEqual(result.changed, [0]);
  assert.equal(result.conflicts.lines, 1);
  assert.equal(result.conflicts.textures, 1);
  const empty = applyLinePurpose(chart, [-1, 4, 0.5], "standard");
  assert.deepEqual(empty.changed, []);
  assert.equal(empty.chart, chart);
});

test("a noise line that cannot be exported is skipped without aborting the batch", () => {
  const trajectory = line({
    eventLayers: [
      {
        moveXEvents: [
          { startTime: [0, 0, 1], endTime: [1, 0, 1], start: 0, end: 0, trajectory: {} },
        ],
      },
    ],
  });
  const plain = line();
  const chart = chartWith([trajectory, plain]);
  const result = applyLinePurpose(chart, [0, 1], "noise");
  assert.deepEqual(result.changed, [1]);
  assert.deepEqual(result.skipped, [{ index: 0, reason: "unsupported" }]);
  assert.equal(result.chart.judgeLineList[0], trajectory);
  assert.equal(noiseLineSettings(result.chart.judgeLineList[1])?.invert, false);
});

test("the pure edit never mutates its input chart", () => {
  const chart = chartWith([
    line({ notes: [note()], Texture: "cover.png" }),
    line({ extended: { textEvents: [event()] } }),
  ]);
  const before = structuredClone(chart);
  applyLinePurpose(chart, [0, 1], "inverted");
  assert.deepEqual(chart, before);
});
