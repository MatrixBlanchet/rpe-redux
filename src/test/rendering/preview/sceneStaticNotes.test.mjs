/** Verifies speed-zero notes use the visible-time index without changing author order. */
import assert from "node:assert/strict";
import test from "node:test";
import { createChart, createNote } from "../../../core/global/chart/chart.ts";
import { SceneRuntime } from "../../../core/global/chart/runtime/scene.ts";
import { fromNumber } from "../../../core/global/chart/timing/beat.ts";
import { TempoMap } from "../../../core/global/chart/timing/tempo.ts";

test("static notes are queried by visible time and keep author order", () => {
  const chart = createChart();
  const line = chart.judgeLineList[0];
  const future = createNote(1, 20, 0);
  const active = createNote(2, 9, 0, 11);
  const expired = createNote(2, 0, 0, 1);
  const nearFuture = createNote(1, 12, 0);
  future.speed = 0;
  future.visibleTime = 1;
  active.speed = 0;
  nearFuture.speed = 0;
  nearFuture.visibleTime = 2;
  expired.speed = 0;
  line.notes = [future, active, expired, nearFuture];

  const tempo = new TempoMap(chart.BPMList);
  const scene = new SceneRuntime();
  scene.compile(chart, tempo);
  const seconds = tempo.seconds(10) + 0.1;
  const state = scene.sample(seconds)[0];
  const visible = scene.lines[0].visibleNotes(seconds, state, 1000);

  assert.deepEqual(
    visible.map((entry) => entry.noteIndex),
    [1, 3],
    "only the visible static notes are returned, in their authored order",
  );
});

test("yControl lines use the time index instead of scanning every note", () => {
  const chart = createChart();
  const line = chart.judgeLineList[0];
  line.yControl = [
    { x: 0, y: 1 },
    { x: 1, y: 0.5 },
  ];
  const future = createNote(1, 20, 0);
  const active = createNote(2, 9, 0, 11);
  const expired = createNote(2, 0, 0, 1);
  const nearFuture = createNote(1, 12, 0);
  future.visibleTime = 1;
  nearFuture.visibleTime = 2;
  line.notes = [future, active, expired, nearFuture];

  const tempo = new TempoMap(chart.BPMList);
  const scene = new SceneRuntime();
  scene.compile(chart, tempo);
  const seconds = tempo.seconds(10) + 0.1;
  const state = scene.sample(seconds)[0];
  const visible = scene.lines[0].visibleNotes(seconds, state, 1000);

  assert.deepEqual(
    visible.map((entry) => entry.noteIndex),
    [1, 3],
    "yControl does not turn the time broad phase back into a full scan",
  );
});

test("a reversed hold is omitted from the scene runtime", () => {
  const chart = createChart();
  const line = chart.judgeLineList[0];
  const reversed = createNote(2, 8, 0, 4);
  reversed.endTime = fromNumber(4);
  line.notes = [reversed, createNote(2, 2, 0, 3)];

  const tempo = new TempoMap(chart.BPMList);
  const scene = new SceneRuntime();
  scene.compile(chart, tempo);
  const seconds = tempo.seconds(1);
  const state = scene.sample(seconds)[0];
  const visible = scene.lines[0].visibleNotes(seconds, state, 1000);

  assert.deepEqual(
    visible.map((entry) => entry.noteIndex),
    [1],
    "reversed notes do not enter the scene's visible-note indexes",
  );
});
