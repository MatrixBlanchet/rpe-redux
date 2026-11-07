import assert from "node:assert/strict";
import test from "node:test";
import { drawEventDragOverlay } from "../../../frontend/screens/editor/workspace/timeline/events/eventDragDrawing.ts";

test("event drag outlines use the selected line and its time projection", () => {
  const event = { startTime: [1, 0, 1], endTime: [2, 0, 1] };
  for (const multi of [false, true]) {
    const calls = [];
    const context = { setLineDash() {}, strokeRect: (...args) => calls.push(args) };
    const session = {
      chart: { judgeLineList: [{ eventLayers: [{ moveXEvents: [event] }] }] },
      lineIndex: 0,
      eventLayer: 0,
      multiLineActive: multi,
      multiLineMode: "events",
      eventSelection: new Set(["moveXEvents:0"]),
      multiEventSelection: new Map([[0, new Set(["moveXEvents:0"])]]),
    };
    const receiver = {
      getSession: () => session,
      gestures: {
        eventInteraction: { drag: { kind: "move" }, delta: () => 1 },
        eventRects: [{ type: "moveXEvents", index: 0, lineIndex: 0, x: 5, width: 10 }],
      },
      viewport: {
        eventVertical: (beat) => beat * 10,
        verticalForLine: (beat) => beat * 20,
      },
    };
    drawEventDragOverlay(receiver, context, 100, 100, { foreground: "white" });
    assert.deepEqual(calls, [multi ? [5, 60, 10, -20] : [5, 30, 10, -10]]);
  }
});
