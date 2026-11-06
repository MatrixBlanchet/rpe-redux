/**
 * Verifies the trajectory panel previews the same replace decision it commits.
 *
 * The preview used to replace unconditionally, so an occupied range looked
 * clean until Apply rejected it. These cases cover both replace modes and the
 * occupied state that disables Apply.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { createChart, createEvent } from "../../../core/global/chart/chart.ts";
import { fromNumber } from "../../../core/global/chart/timing/beat.ts";
import { TRAJECTORY_DEFAULTS } from "../../../core/global/chart/trajectory/curveTrajectory.ts";
import {
  createTrajectoryEvent,
  generateTrajectoryChart,
} from "../../../core/edit/events/trajectoryCommands.ts";
import {
  buildTrajectoryPreview,
  trajectoryRangeOccupied,
} from "../../../frontend/screens/editor/inspector/trajectory/trajectoryPreview.ts";

/** A chart whose active line carries the given moveX events. */
function chartWith(events) {
  const chart = createChart();
  const [line] = chart.judgeLineList;
  chart.judgeLineList = [{ ...line, eventLayers: [{ moveXEvents: events }] }];
  return chart;
}

/** The generated trajectory event used by every case. */
function trajectoryEvent(start = 2, end = 4) {
  return createTrajectoryEvent(TRAJECTORY_DEFAULTS, fromNumber(start), fromNumber(end), 16, {
    simplify: false,
  });
}

/** The moveX list on the active line's first layer. */
function moveX(chart) {
  return chart.judgeLineList[0].eventLayers[0].moveXEvents;
}

test("a non-replace preview flags the range Apply rejects", () => {
  const existing = createEvent(0, 0, 1, 3);
  const chart = chartWith([existing]);
  const event = trajectoryEvent();

  assert.equal(trajectoryRangeOccupied(chart, 0, 0, event, null), true);
  const preview = buildTrajectoryPreview(chart, 0, 0, event, null, false);
  assert.equal(preview.occupied, true, "the panel can disable Apply before the click");
  // The fallback still draws the intended path by replacing only for display.
  assert.ok(!moveX(preview.chart).includes(existing));

  assert.throws(
    () => generateTrajectoryChart(chart, 0, 0, event, null, false),
    "Apply rejects the same range",
  );
});

test("a replace preview and commit both clear only the intersecting event", () => {
  const intersecting = createEvent(0, 0, 1, 3);
  const outside = createEvent(0, 0, 5, 6);
  const chart = chartWith([intersecting, outside]);
  const event = trajectoryEvent();

  assert.equal(trajectoryRangeOccupied(chart, 0, 0, event, null), true);
  const preview = buildTrajectoryPreview(chart, 0, 0, event, null, true);
  assert.equal(preview.occupied, false);
  assert.ok(!moveX(preview.chart).includes(intersecting));
  assert.ok(moveX(preview.chart).includes(outside), "events outside the range survive");
  assert.ok(moveX(preview.chart).includes(event), "the preview writes the generated event");

  const committed = generateTrajectoryChart(chart, 0, 0, event, null, true);
  assert.ok(!moveX(committed).includes(intersecting));
  assert.ok(moveX(committed).includes(outside));
});

test("a free non-replace preview keeps adjacent events like Apply does", () => {
  const adjacent = createEvent(0, 0, 0, 2);
  const chart = chartWith([adjacent]);
  const event = trajectoryEvent();

  assert.equal(trajectoryRangeOccupied(chart, 0, 0, event, null), false);
  const preview = buildTrajectoryPreview(chart, 0, 0, event, null, false);
  assert.equal(preview.occupied, false);
  assert.ok(moveX(preview.chart).includes(adjacent));
  assert.ok(moveX(preview.chart).includes(event));

  const committed = generateTrajectoryChart(chart, 0, 0, event, null, false);
  assert.ok(moveX(committed).includes(adjacent));
});

test("the edited event does not occupy its own range", () => {
  const editing = trajectoryEvent(2, 4);
  const chart = chartWith([editing]);
  const event = trajectoryEvent(2, 4);

  assert.equal(trajectoryRangeOccupied(chart, 0, 0, event, editing), false);
  const preview = buildTrajectoryPreview(chart, 0, 0, event, editing, false);
  assert.equal(preview.occupied, false);
});
