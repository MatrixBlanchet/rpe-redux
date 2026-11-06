/** The Bézier inspector preview uses a detached chart and never writes history. */
import assert from "node:assert/strict";
import test from "node:test";
import { createChart, createEvent } from "../core/global/chart/chart.ts";
import { EditorSession } from "../core/edit/session/session.ts";
import { eventCurvePreviewSession } from "../frontend/screens/editor/inspector/events/eventCurvePreview.ts";

/** Build one selected Bézier event on a fresh chart. */
function eventSession() {
  const chart = createChart();
  const event = {
    ...createEvent(0, 0, 0, 4),
    bezier: 1,
    bezierPoints: [0.1, 0.2, 0.9, 0.8],
  };
  chart.judgeLineList[0].eventLayers[0].moveXEvents = [event];
  const session = new EditorSession(chart);
  session.focus = "events";
  session.eventSelection = new Set(["moveXEvents:0"]);
  return session;
}

test("Bezier curve preview changes the timeline chart without touching live history", () => {
  const session = eventSession();
  const preview = eventCurvePreviewSession(session, [0.3, 0.1, 0.7, 0.9]);

  assert.notEqual(preview, session);
  assert.deepEqual(
    preview.chart.judgeLineList[0].eventLayers[0].moveXEvents[0].bezierPoints,
    [0.3, 0.1, 0.7, 0.9],
  );
  assert.deepEqual(
    session.chart.judgeLineList[0].eventLayers[0].moveXEvents[0].bezierPoints,
    [0.1, 0.2, 0.9, 0.8],
  );
  assert.equal(session.history.undoStack.length, 0);
  assert.equal(preview.history.undoStack.length, 0);
  assert.deepEqual([...preview.eventSelection], ["moveXEvents:0"]);
});
