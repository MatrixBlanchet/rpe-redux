/** Verifies long holds remain pickable after moving them to the coarse grid. */
import assert from "node:assert/strict";
import test from "node:test";
import { PreviewNoteSpatialIndex } from "../frontend/screens/editor/workspace/preview/interaction/previewSpatialIndex.ts";

function hold(noteIndex, x, y, length) {
  return {
    lineIndex: 0,
    noteIndex,
    kind: "hold",
    head: { x, y },
    tail: { x: x + length, y: y + length },
    radius: 2,
    width: 16,
    rotation: 0,
  };
}

test("long holds are returned once from the coarse grid", () => {
  const notes = [
    hold(0, 0, 0, 1200),
    hold(1, 2000, 0, 1200),
    { ...hold(2, 500, 500, 0), kind: "note", height: 16 },
  ];
  const index = new PreviewNoteSpatialIndex(notes);
  const nearHead = index.queryPoint({ x: 600, y: 600 }, 0);
  assert.deepEqual(
    nearHead.map((note) => note.noteIndex),
    [0],
    "a long hold is found at its centre",
  );
  const far = index.queryPoint({ x: 5000, y: 5000 }, 0);
  assert.deepEqual(far, [], "unrelated long holds stay out of a distant query");
});
