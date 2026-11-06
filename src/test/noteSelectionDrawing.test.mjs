import assert from "node:assert/strict";
import test from "node:test";
import {
  selectOverlappingNote,
  selectedNoteIndices,
} from "../frontend/screens/editor/workspace/timeline/notes/noteSelectionDrawing.ts";
import { drawNote } from "../frontend/screens/editor/workspace/timeline/notes/noteDrawing.ts";

test("single-line and multi-line notes share the selected-note source", () => {
  const session = {
    lineIndex: 2,
    selection: new Set([4]),
    multiLineActive: false,
    multiLineMode: "notes",
    multiLineSelection: new Map([[2, new Set([7])]]),
  };

  assert.deepEqual([...selectedNoteIndices(session, 2)], [4]);

  session.multiLineActive = true;
  assert.deepEqual([...selectedNoteIndices(session, 2)], [7]);
  assert.deepEqual([...selectedNoteIndices(session, 3)], []);
});

test("selected timeline notes use the note renderer's colorize mode", () => {
  let colorStyle;
  const palette = {
    noteTap: "blue",
    noteHold: "blue",
    noteFlick: "blue",
    noteDrag: "blue",
    noteFallback: "blue",
    selectionHighlightStroke: "#00c800",
  };
  const receiver = {
    cache: { palette: () => palette },
    appearance: { noteOpacity: 1, skin: null },
    noteBatch: {
      addHead: (...args) => {
        colorStyle = args[9];
        return true;
      },
      addHold: () => true,
    },
  };
  const context = { globalAlpha: 1, fillStyle: "" };

  drawNote.call(receiver, context, {
    note: { type: 1, isFake: 0, above: 1 },
    horizontal: 10,
    vertical: 20,
    endVertical: 20,
    noteWidth: 40,
    height: 100,
    selected: true,
  });

  assert.deepEqual(colorStyle, { mode: "selected", color: [0, 200, 0] });
});

test("choosing an overlapping note invalidates the timeline immediately", () => {
  let changed = 0;
  const session = {
    chart: { judgeLineList: [{ Name: "Line 1" }] },
    focus: "events",
    lineIndex: 0,
    selection: new Set(),
    multiLineSelection: new Map(),
    multiLineIndices: [0],
    multiLineEnabled: true,
    selectionRevision: 0,
    selectionState: () => ({}),
    normalizeMultiLine() {},
    recordSelection() {},
  };
  selectOverlappingNote(session, { lineIndex: 0, index: 2 }, () => (changed += 1));

  assert.equal(changed, 1);
  assert.deepEqual([...session.selection], [2]);
});
