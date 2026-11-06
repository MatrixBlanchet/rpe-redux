/** Group-row batch toggles in the toolbar judge-line picker. */
import assert from "node:assert/strict";
import test from "node:test";
import { toggleGroupSelection } from "../frontend/screens/editor/toolbar/lineSelectionGroupSelection.ts";

test("a partly selected group adds all its lines and keeps other groups", () => {
  const result = toggleGroupSelection(new Set([1, 5]), [1, 2, 3], 1);
  assert.deepEqual(result.selection, [1, 2, 3, 5]);
  assert.equal(result.focus, 1);
});

test("a fully selected group is removed while other groups stay selected", () => {
  const result = toggleGroupSelection(new Set([1, 2, 3, 9]), [1, 2, 3], 9);
  assert.deepEqual(result.selection, [9]);
  assert.equal(result.focus, 9);
});

test("removing the only selected group falls back to the current line", () => {
  const result = toggleGroupSelection(new Set([2, 3]), [2, 3], 3);
  assert.deepEqual(result.selection, [3]);
  assert.equal(result.focus, 3);
});

test("focus stays on the current line when it survives the toggle", () => {
  const result = toggleGroupSelection(new Set([1, 9]), [1, 2], 9);
  assert.deepEqual(result.selection, [1, 2, 9]);
  assert.equal(result.focus, 9);
});

test("focus moves to the nearest surviving line when the current line is removed", () => {
  const result = toggleGroupSelection(new Set([1, 2, 3, 10]), [2, 3], 2);
  assert.deepEqual(result.selection, [1, 10]);
  assert.equal(result.focus, 1);
});

test("focus falls back to the group's first line when the current line is absent", () => {
  const result = toggleGroupSelection(new Set([5]), [7, 8, 9], 6);
  assert.deepEqual(result.selection, [5, 7, 8, 9]);
  assert.equal(result.focus, 7);
});

test("empty, unsorted, and duplicated group indices stay harmless", () => {
  const empty = toggleGroupSelection(new Set([4]), [], 4);
  assert.deepEqual(empty.selection, [4]);
  assert.equal(empty.focus, 4);

  const unsorted = toggleGroupSelection(new Set([3]), [3, 1, 2], 3);
  assert.deepEqual(unsorted.selection, [1, 2, 3]);
  assert.equal(unsorted.focus, 3);

  const duplicated = toggleGroupSelection(new Set([1, 2]), [2, 2, 1], 1);
  assert.deepEqual(duplicated.selection, [1]);
  assert.equal(duplicated.focus, 1);
});

test("the input selection is never mutated", () => {
  const selection = new Set([1, 5]);
  toggleGroupSelection(selection, [1, 2, 3], 1);
  assert.deepEqual(
    [...selection].sort((left, right) => left - right),
    [1, 5],
  );
});
