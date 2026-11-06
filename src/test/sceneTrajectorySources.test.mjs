/**
 * Verifies incremental scene compilation reuses the virtual Y/rotation copy that
 * belongs to a trajectory event even when the event track was sorted by start.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { createChart, createEvent } from "../core/global/chart/chart.ts";
import { SceneRuntime } from "../core/global/chart/runtime/scene.ts";
import { TRAJECTORY_DEFAULTS } from "../core/global/chart/trajectory/curveTrajectory.ts";
import { fromNumber } from "../core/global/chart/timing/beat.ts";
import { TempoMap } from "../core/global/chart/timing/tempo.ts";
import { createTrajectoryEvent } from "../core/edit/events/trajectoryCommands.ts";

test("an early trajectory keeps its virtual Y source after sorted compilation", () => {
  const chart = createChart();
  const notes = [];
  const line = {
    ...chart.judgeLineList[0],
    id: "line-1",
    notes,
    eventLayers: [
      {
        moveXEvents: [
          createTrajectoryEvent(TRAJECTORY_DEFAULTS, fromNumber(0), fromNumber(1), 8, {
            simplify: false,
          }),
        ],
        moveYEvents: [createEvent(0, 0, 5, 6)],
      },
    ],
  };
  const firstChart = { ...chart, judgeLineList: [line] };
  const tempo = new TempoMap(chart.BPMList);
  const scene = new SceneRuntime();
  scene.compile(firstChart, tempo);
  const firstY = scene.lines[0].tracks.moveYEvents[0].sources;
  const firstVirtual = firstY.find((event) => event.trajectoryAxis === "y");
  assert.ok(firstVirtual, "the initial compile creates the virtual Y copy");

  const nextLine = {
    ...line,
    eventLayers: [
      {
        moveXEvents: [...line.eventLayers[0].moveXEvents],
        moveYEvents: [...line.eventLayers[0].moveYEvents],
      },
    ],
  };
  scene.compile({ ...firstChart, judgeLineList: [nextLine] }, tempo);
  const nextY = scene.lines[0].tracks.moveYEvents[0].sources;
  const nextVirtual = nextY.find((event) => event.trajectoryAxis === "y");

  assert.equal(nextVirtual, firstVirtual, "the virtual copy is matched by trajectory, not offset");
  assert.ok(nextY.includes(nextVirtual));
  assert.equal(nextY.length, 2, "one base Y event and one virtual copy");
});
