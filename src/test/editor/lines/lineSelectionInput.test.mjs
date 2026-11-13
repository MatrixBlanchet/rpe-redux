/**
 * The toolbar judge-line field's grammar: index/range unions with comma or
 * whitespace separators, clamping, and the multi-line active-line annotation.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  formatLineSelection,
  formatLineSelectionDisplay,
  parseLineSelectionInput,
} from "../../../core/edit/state/lineSelectionInput.ts";

const LINES = Array.from({ length: 24 }, (_, index) => index);

/** The selected lines, or null when the text is refused. */
function select(raw, available = LINES) {
  return parseLineSelectionInput(raw, available)?.lines ?? null;
}

/** The active line the parser would commit, or null when the text is refused. */
function active(raw, available = LINES) {
  return parseLineSelectionInput(raw, available)?.line ?? null;
}

test("an ASCII comma, a CJK comma, and a space all separate lines", () => {
  for (const raw of ["0,15", "0，15", "0 15"]) {
    assert.deepEqual(select(raw), [0, 15], raw);
    assert.equal(active(raw), 0, raw);
  }
});

test("separator styles can be mixed in one expression", () => {
  assert.deepEqual(select("0，15 20,22"), [0, 15, 20, 22]);
  assert.deepEqual(select("0-2, 5 7-8"), [0, 1, 2, 5, 7, 8]);
});

test("repeated separators are ignored", () => {
  assert.deepEqual(select("0   15"), [0, 15]);
  assert.deepEqual(select("0,,15"), [0, 15]);
  assert.deepEqual(select("0，， 15"), [0, 15]);
});

test("range expressions keep colon, CJK colon, and hyphen forms", () => {
  assert.deepEqual(select("0-3"), [0, 1, 2, 3]);
  assert.deepEqual(select("2:5"), [2, 3, 4, 5]);
  assert.deepEqual(select("2：5"), [2, 3, 4, 5]);
  assert.deepEqual(select("0 - 3"), [0, 1, 2, 3]);
  assert.deepEqual(select("0 : 3"), [0, 1, 2, 3]);
  assert.deepEqual(select("0 ： 3"), [0, 1, 2, 3]);
  assert.deepEqual(select("0：3,5"), [0, 1, 2, 3, 5]);
  assert.deepEqual(select("0：3 5"), [0, 1, 2, 3, 5]);
});

test("a reversed range reads in ascending order", () => {
  assert.deepEqual(select("5-2"), [2, 3, 4, 5]);
});

test("lines outside the document clamp to the nearest existing line", () => {
  assert.deepEqual(select("72"), [23]);
  assert.deepEqual(select("-3:100"), LINES);
  assert.deepEqual(select("0-4", [0, 2, 4]), [0, 2, 4]);
});

test("a trailing parenthesized line is the active-line annotation", () => {
  assert.deepEqual(select("0-15 (3)"), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
  assert.equal(active("0-15 (3)"), 3);
  assert.deepEqual(select("0-15(20)"), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
  assert.equal(active("0-15(20)"), 20);
  assert.equal(active("0-15（3）"), 3);
  assert.deepEqual(select("0，15 (20)"), [0, 15]);
  assert.equal(active("0，15 (20)"), 20);
});

test("the annotation does not have to belong to the union", () => {
  // The active line can sit outside the multi-line set after Ctrl+wheel moved it.
  assert.deepEqual(select("0-5 (20)"), [0, 1, 2, 3, 4, 5]);
  assert.equal(active("0-5 (20)"), 20);
});

test("a single parenthesized index names that one line", () => {
  assert.deepEqual(select("(0)"), [0]);
  assert.equal(active("(0)"), 0);
  assert.deepEqual(select("（3）"), [3]);
});

test("an RPE-style label keeps its line and ignores the annotation on a single line", () => {
  // RPE writes a parent line as `1(0)`; the selected line stays 1.
  assert.deepEqual(select("1(0)"), [1]);
  assert.equal(active("1(0)"), 1);
});

test("the annotation clamps to the document", () => {
  assert.equal(active("0-3 (99)"), 23);
});

test("invalid text is refused", () => {
  assert.equal(select(""), null);
  assert.equal(select("   "), null);
  assert.equal(select("abc"), null);
  assert.equal(select("0-"), null);
  assert.equal(select("0-15 (3) x"), null);
  assert.equal(select("(3"), null);
  assert.equal(select("0", []), null);
});

test("formatting writes the compact union the field commits", () => {
  assert.equal(formatLineSelection([0, 1, 2, 3, 15]), "0-3,15");
  assert.equal(formatLineSelection([5, 2, 1]), "1-2,5");
  assert.equal(formatLineSelection([]), "");
});

test("the display text carries the active line only for a union", () => {
  assert.equal(formatLineSelectionDisplay([0, 1, 2], 3), "0-2 (3)");
  assert.equal(formatLineSelectionDisplay([0, 1, 2, 3, 15], 3), "0-3,15 (3)");
  assert.equal(formatLineSelectionDisplay([7], 3), "7");
  assert.equal(formatLineSelectionDisplay([], 3), "");
});

test("display text parses back to the same union and active line", () => {
  for (const [lines, activeLine] of [
    [[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], 3],
    [[0, 15, 20, 22], 20],
    [[2, 3], 21],
    [[4], 4],
  ]) {
    const text = formatLineSelectionDisplay(lines, activeLine);
    assert.deepEqual(select(text), lines, text);
    assert.equal(active(text), activeLine, text);
  }
});
