/**
 * Merged toolbar flows keep separators only between visible entries.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { continuousEntries } from "../../../frontend/chrome/toolbar/toolbarEntries.ts";

/** Minimal toolbar action entry for the ordering helper. */
function action(id, row = 1) {
  return { kind: "action", id, row, order: 0, label: id };
}

/** Minimal divider entry. */
function divider(id, row = 1) {
  return { kind: "divider", id, row, order: 0 };
}

test("a merged flow drops leading, trailing, and repeated dividers", () => {
  const entries = [
    divider("leading"),
    action("a"),
    divider("between-1"),
    divider("between-2"),
    action("b"),
    divider("trailing"),
  ];
  assert.deepEqual(
    continuousEntries(entries).map((entry) => entry.id),
    ["a", "between-2", "b"],
  );
});

test("a merged flow keeps one divider between separated groups", () => {
  const entries = [action("a"), divider("rule"), action("b"), action("c")];
  assert.deepEqual(
    continuousEntries(entries).map((entry) => entry.id),
    ["a", "rule", "b", "c"],
  );
});
