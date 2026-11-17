/** Event-bar edge gesture zones and drag anchors. */
import assert from "node:assert/strict";
import test from "node:test";
import { createChart, createEvent } from "../../../core/global/chart/chart.ts";
import { beatValue } from "../../../core/global/chart/timing/beat.ts";
import { EditorSession } from "../../../core/edit/session/session.ts";
import {
  eventEdgeAt,
  eventEdgeDragFor,
} from "../../../frontend/screens/editor/workspace/timeline/events/eventEdgeDrag.ts";

const rect = { x: 0, y: 100, width: 20, height: 40, index: 0, type: "moveXEvents" };

function sessionWithEvent() {
  const chart = createChart();
  chart.judgeLineList[0].eventLayers[0].moveXEvents = [createEvent(0, 0, 2, 4)];
  return new EditorSession(chart);
}

test("the top and bottom edge zones map to the matching event edge", () => {
  assert.equal(eventEdgeAt(rect, { x: 0, y: 100 }), "endTime");
  assert.equal(eventEdgeAt(rect, { x: 0, y: 140 }), "startTime");
  assert.equal(eventEdgeAt(rect, { x: 0, y: 120 }), null);
});

test("an edge drag anchors on the edge being moved", () => {
  const session = sessionWithEvent();
  const timeline = {
    getSession: () => session,
    viewport: { tempo: { seconds: () => 0 }, origin: 0, factorForLine: () => 1 },
  };

  const head = eventEdgeDragFor(timeline, rect, { x: 0, y: 140 }, "startTime", 7);
  assert.ok(head);
  assert.equal(head.kind, "startTime");
  assert.equal(beatValue(head.anchor), 2);
  assert.equal(head.pointerId, 7);

  const tail = eventEdgeDragFor(timeline, rect, { x: 0, y: 100 }, "endTime", 8);
  assert.ok(tail);
  assert.equal(tail.kind, "endTime");
  assert.equal(beatValue(tail.anchor), 4);
});
