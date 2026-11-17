/** Z-drag edge edits clamp the moved head or tail to the remaining anchor. */
import assert from "node:assert/strict";
import test from "node:test";
import { createChart, createEvent } from "../../../core/global/chart/chart.ts";
import { beatValue } from "../../../core/global/chart/timing/beat.ts";
import { shiftSelectedEvents } from "../../../core/edit/timeline/selection.ts";
import { EditorSession } from "../../../core/edit/session/session.ts";

/** A session whose first moveX event spans beats 2-4 and is selected. */
function selectedEventSession() {
  const chart = createChart();
  chart.judgeLineList[0].eventLayers[0].moveXEvents = [createEvent(0, 0, 2, 4)];
  const session = new EditorSession(chart);
  session.eventSelection = new Set(["moveXEvents:0"]);
  return session;
}

/** The selected event after one edge shift. */
function eventAfter(session) {
  return session.chart.judgeLineList[0].eventLayers[0].moveXEvents[0];
}

test("a head drag cannot pass beat zero", () => {
  const session = selectedEventSession();
  shiftSelectedEvents(session, "startTime", -10, "test");

  const event = eventAfter(session);
  assert.equal(beatValue(event.startTime), 0);
  assert.equal(beatValue(event.endTime), 4);
});

test("a head drag cannot pass the tail", () => {
  const session = selectedEventSession();
  shiftSelectedEvents(session, "startTime", 10, "test");

  const event = eventAfter(session);
  assert.equal(beatValue(event.startTime), 4);
  assert.equal(beatValue(event.endTime), 4);
});

test("a tail drag cannot pass the head", () => {
  const session = selectedEventSession();
  shiftSelectedEvents(session, "endTime", -10, "test");

  const event = eventAfter(session);
  assert.equal(beatValue(event.startTime), 2);
  assert.equal(beatValue(event.endTime), 2);
});
