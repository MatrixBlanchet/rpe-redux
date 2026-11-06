/** Covers the fixed-distance same-beat note overlap warning. */
import assert from "node:assert/strict";
import test from "node:test";
import { createNote } from "../core/global/chart/chart.ts";
import {
  DEFAULT_NOTE_OVERLAP_THRESHOLD,
  overlappingNotePositions,
} from "../core/edit/timeline/noteOverlap.ts";

test("only same-beat notes inside the fixed distance are marked", () => {
  const notes = [
    createNote(1, 1, 0),
    createNote(1, 1, 50),
    createNote(1, 1, 170),
    createNote(1, 2, 10),
    createNote(2, 1, 20),
  ];
  const positions = overlappingNotePositions(notes, DEFAULT_NOTE_OVERLAP_THRESHOLD);
  assert.deepEqual(
    [...positions].sort((left, right) => left - right),
    [0, 1],
  );
});

test("a non-positive threshold turns the warning off", () => {
  const notes = [createNote(1, 1, 0), createNote(1, 1, 1)];
  assert.equal(overlappingNotePositions(notes, 0).size, 0);
});
