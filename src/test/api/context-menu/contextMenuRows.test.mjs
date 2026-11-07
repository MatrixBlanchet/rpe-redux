/** Registry rows hide by `visible` and disable by `enabled`, never both. */
import assert from "node:assert/strict";
import test from "node:test";
import { contextMenu } from "../../../core/shell/registries/contextMenu.ts";
import { toolbar } from "../../../core/shell/registries/toolbar.ts";
import {
  resolveContextMenuRows,
  resolveMenuRow,
} from "../../../frontend/overlays/contextMenu/menuRowModel.ts";

test("resolveMenuRow separates visibility from enablement", () => {
  assert.deepEqual(resolveMenuRow({}), { visible: true, disabled: false });
  assert.deepEqual(resolveMenuRow({ visible: () => false, enabled: () => false }), {
    visible: false,
    disabled: true,
  });
  assert.deepEqual(resolveMenuRow({ visible: () => true, enabled: () => false }), {
    visible: true,
    disabled: true,
  });
});

test("a disabled registry row stays in the menu and refuses its command", () => {
  let runs = 0;
  const dispose = contextMenu.register({
    id: "test.rows.disabled",
    order: 1,
    contexts: ["progress"],
    label: "Disabled row",
    enabled: () => false,
    run() {
      runs += 1;
    },
  });
  try {
    const row = resolveContextMenuRows("progress").find(
      (candidate) => candidate.key === "contributed:test.rows.disabled",
    );
    assert.ok(row, "a disabled row is still offered");
    assert.equal(row.disabled, true);
    row.select();
    assert.equal(runs, 0);
  } finally {
    dispose();
  }
});

test("a hidden registry row is left out of the menu", () => {
  const dispose = contextMenu.register({
    id: "test.rows.hidden",
    order: 1,
    contexts: ["progress"],
    label: "Hidden row",
    visible: () => false,
    run() {},
  });
  try {
    assert.equal(
      resolveContextMenuRows("progress").some((row) => row.key === "contributed:test.rows.hidden"),
      false,
    );
  } finally {
    dispose();
  }
});

test("an enabled registry row runs with the menu target", () => {
  const target = { surface: "marker", beat: 2 };
  let seen;
  const dispose = contextMenu.register({
    id: "test.rows.enabled",
    order: 1,
    contexts: ["marker"],
    label: "Enabled row",
    run(next) {
      seen = next;
    },
  });
  try {
    const row = resolveContextMenuRows("marker", target).find(
      (candidate) => candidate.key === "contributed:test.rows.enabled",
    );
    assert.ok(row);
    assert.equal(row.disabled, false);
    row.select();
    assert.equal(seen, target);
  } finally {
    dispose();
  }
});

test("a toolbar command follows the same visibility and enablement rule", () => {
  let runs = 0;
  const dispose = toolbar.register({
    kind: "action",
    id: "test.rows.toolbar-disabled",
    order: 1,
    group: "test",
    label: "Toolbar row",
    tooltip: "Toolbar row",
    icon: "play",
    contexts: ["progress"],
    enabled: () => false,
    run() {
      runs += 1;
    },
  });
  try {
    const row = resolveContextMenuRows("progress").find(
      (candidate) => candidate.key === "toolbar:test.rows.toolbar-disabled",
    );
    assert.ok(row);
    assert.equal(row.disabled, true);
    row.select();
    assert.equal(runs, 0);
  } finally {
    dispose();
  }
});
