/**
 * Switching the multi-line field (the `K` shortcut or the panel selector) keeps
 * the session's focus and the Inspector routing on the field that is on screen.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { createChart, createEvent, createLine } from "../../../core/global/chart/chart.ts";
import { multiLineEntryMode } from "../../../core/edit/multiLine/multiLineEdit.ts";
import { EditorSession } from "../../../core/edit/session/session.ts";
import {
  resolveSelectionPane,
  selectionPaneSignature,
} from "../../../frontend/screens/editor/workspace/runtime/bridge/selectionPaneRouting.ts";

/** A chart with three lines so a multi-line selection can hold. */
function chartWithLines() {
  const chart = createChart();
  chart.judgeLineList = [createLine("L0"), createLine("L1"), createLine("L2")];
  return chart;
}

const paneState = {
  activePane: "notes",
  multiEditCommitting: false,
  trajectoryActive: false,
  curveEditorOpen: false,
  pointerSelection: false,
  initialRoute: false,
  lineChanged: false,
};

test("switching the multi-line mode moves focus to the field on screen", () => {
  const session = new EditorSession(chartWithLines());
  session.setMultiLineSelection([0, 1, 2]);
  assert.equal(session.multiLineMode, "notes");
  assert.equal(session.focus, "notes");

  session.setMultiLineMode("events");
  assert.equal(session.focus, "events");
  session.setMultiLineMode("notes");
  assert.equal(session.focus, "notes");
});

test("a mode switch re-routes the Inspector to the newly visible field", () => {
  const chart = chartWithLines();
  chart.judgeLineList[0].eventLayers[0].moveXEvents = [createEvent(0, 4)];
  const session = new EditorSession(chart);
  session.setMultiLineSelection([0, 1, 2]);
  session.multiEventSelection = new Map([[0, new Set(["moveXEvents:0"])]]);
  session.eventSelection = new Set(["moveXEvents:0"]);
  session.focus = "notes";
  session.selectionMode = "single";

  const before = selectionPaneSignature(session, 0);
  session.setMultiLineMode("events");
  assert.notEqual(selectionPaneSignature(session, 0), before);
  assert.deepEqual(resolveSelectionPane(session, 0, paneState).action, {
    kind: "activate-pane",
    name: "events",
  });
});

test("a single-line session keeps its pointer focus across a mode write", () => {
  const session = new EditorSession(chartWithLines());
  session.focus = "events";
  session.setMultiLineMode("notes");
  assert.equal(session.focus, "events");
});

test("multi-line opens on the field being edited unless a region hides one", () => {
  assert.equal(multiLineEntryMode({ notes: true, events: true }, "events"), "events");
  assert.equal(multiLineEntryMode({ notes: true, events: true }, "notes"), "notes");
  assert.equal(multiLineEntryMode({ notes: false, events: true }, "notes"), "events");
  assert.equal(multiLineEntryMode({ notes: true, events: false }, "events"), "notes");
  assert.equal(multiLineEntryMode({ notes: false, events: false }, "events"), "events");
});
