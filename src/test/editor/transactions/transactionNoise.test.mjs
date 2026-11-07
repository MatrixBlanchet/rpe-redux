/**
 * Noise-line validation runs in the plan and at the common commit boundary.
 * A transaction may skip the second check, but paste, remote, and hook paths
 * must still reject an incompatible line.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { createChart, createLine, createNote } from "../../../core/global/chart/chart.ts";
import { setNoiseLineMode } from "../../../core/global/chart/noise/noiseLine.ts";
import { EditorSession } from "../../../core/edit/session/session.ts";
import { applyChartTransaction } from "../../../core/edit/transaction/preview.ts";
import { extensionRegistry } from "../../../core/extensions/runtime.ts";

/** A chart whose only line is a noise area, optionally with a conflicting note. */
function noiseChart(withNote = false) {
  const chart = createChart();
  const base = createLine("Noise");
  const line = setNoiseLineMode({ ...base, notes: [], numOfNotes: 0, eventLayers: [] }, "normal");
  if (withNote) {
    line.notes = [createNote(1, 1, 0)];
    line.numOfNotes = 1;
  }
  chart.judgeLineList = [line];
  return chart;
}

test("transaction planning rejects an incompatible noise line before commit", () => {
  const session = new EditorSession(noiseChart(true));
  const before = session.chart;
  const result = applyChartTransaction(session, { metadata: { name: "renamed" } });
  assert.equal(result.status, "rejected");
  assert.ok(result.issues.some((issue) => issue.code === "noise.line.incompatible"));
  assert.equal(session.chart, before);
  assert.equal(session.history.undoStack.length, 0);
});

test("a valid noise transaction commits without a conflicting note", () => {
  const session = new EditorSession(noiseChart(false));
  const result = applyChartTransaction(session, { metadata: { name: "renamed" } });
  assert.equal(result.status, "committed");
  assert.equal(session.chart.META.name, "renamed");
});

test("the session commit boundary still rejects non-transaction noise writes", () => {
  const chart = noiseChart(true);
  const session = new EditorSession(noiseChart(false));
  assert.equal(session.commitChart("paste", chart), false);
  assert.equal(session.commitRemoteChart("remote", chart), false);
  assert.equal(session.history.undoStack.length, 0);
});

test("a before-commit hook cannot replace a planned chart with invalid noise", () => {
  const session = new EditorSession(noiseChart(false));
  const before = session.chart;
  const dispose = extensionRegistry.onHook("session:before-commit", (payload) => {
    const line = payload.chart.judgeLineList[0];
    line.notes = [createNote(1, 1, 0)];
    line.numOfNotes = 1;
  });
  try {
    const result = applyChartTransaction(session, { metadata: { name: "renamed" } });
    assert.equal(result.status, "rejected");
    assert.equal(session.chart, before);
    assert.equal(session.history.undoStack.length, 0);
  } finally {
    dispose();
  }
});
