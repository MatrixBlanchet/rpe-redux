/**
 * Toolbar row contract: hidden actions reserve no cell and a divider only
 * survives between two visible entries.
 *
 * The editor rows and the default rows share this filter, so the test calls the
 * shared helper rather than either React component.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  continuousEntries,
  toolbarEntryDraws,
  visibleToolbarEntries,
} from "../frontend/chrome/toolbar/toolbarEntries.ts";

/** One registered action with the fields the filter reads. */
function action(id, row, overrides = {}) {
  return {
    kind: "action",
    id,
    order: Number(id.replace(/\D/gu, "")) || 0,
    row,
    group: "test",
    label: id,
    tooltip: id,
    icon: "help",
    ...overrides,
  };
}

/** One registered divider. */
function divider(id, row) {
  return { kind: "divider", id, row, order: Number(id.replace(/\D/gu, "")) || 0 };
}

test("hidden and menu-only actions reserve no toolbar cell", () => {
  const entries = [
    action("hidden1", 1, { visible: () => false }),
    action("menuOnly2", 1, { toolbar: false }),
    action("visible3", 1),
  ];

  assert.deepEqual(
    visibleToolbarEntries(entries, 1).map((entry) => entry.id),
    ["visible3"],
  );
  assert.equal(toolbarEntryDraws(entries[0]), false);
  assert.equal(toolbarEntryDraws(entries[1]), false);
  assert.equal(toolbarEntryDraws(entries[2]), true);
});

test("a row keeps only dividers between visible entries and drops repeats", () => {
  const entries = [
    divider("lead1", 1),
    action("hidden2", 1, { visible: () => false }),
    divider("lead3", 1),
    action("visible4", 1),
    divider("kept5", 1),
    action("hidden6", 1, { visible: () => false }),
    divider("replacement7", 1),
    action("visible8", 1),
    divider("trail9", 1),
  ];

  assert.deepEqual(
    visibleToolbarEntries(entries, 1).map((entry) => entry.id),
    ["visible4", "replacement7", "visible8"],
  );
});

test("row filtering leaves other rows for their own line", () => {
  const entries = [
    action("rowOne1", 1),
    action("rowTwo2", 2),
    divider("rowTwo3", 2),
    action("rowTwo4", 2),
  ];

  assert.deepEqual(
    visibleToolbarEntries(entries, 1).map((entry) => entry.id),
    ["rowOne1"],
  );
  assert.deepEqual(
    visibleToolbarEntries(entries, 2).map((entry) => entry.id),
    ["rowTwo2", "rowTwo3", "rowTwo4"],
  );
});

test("merged flows still collapse a seam divider to one rule", () => {
  const entries = [
    divider("lead1", 1),
    action("first2", 1),
    divider("seam3", 1),
    divider("seam4", 2),
    action("second5", 2),
    divider("trail6", 2),
  ];

  assert.deepEqual(
    continuousEntries(visibleToolbarEntries(entries)).map((entry) => entry.id),
    ["first2", "seam4", "second5"],
  );
});
