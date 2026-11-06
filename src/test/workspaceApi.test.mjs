/** The public workspace handle reads the drawer's single frontend-owned state. */
import assert from "node:assert/strict";
import test from "node:test";
import { workspace } from "../core/api/workspace.ts";
import * as coreDrawer from "../core/shell/drawerPane.ts";
import {
  closeDrawer,
  getDrawerState,
  registerDrawerPane,
  subscribeDrawer,
  toggleDrawerPane,
} from "../frontend/chrome/drawer/drawerPanes.ts";

/** Registers one document page under a test id. */
function registerTestDrawer(id) {
  return registerDrawerPane({
    id,
    order: 1,
    label: "test.documentPage",
    icon: "grid",
    body: () => null,
  });
}

/** Asserts that the SDK read is exactly the frontend drawer selection. */
function assertCoreMatchesFrontend() {
  assert.equal(workspace.drawerPane(), getDrawerState().pane);
  assert.equal(coreDrawer.readDrawerPane(), getDrawerState().pane);
}

test("workspace opens registered panes through the single frontend write entry", () => {
  const disposeTiming = registerTestDrawer("test:workspace-timing");
  const disposeLines = registerTestDrawer("test:workspace-lines");
  closeDrawer();
  let notifications = 0;
  const unsubscribe = subscribeDrawer(() => {
    notifications += 1;
  });
  try {
    assert.equal(workspace.openDrawerPane("test:workspace-timing"), true);
    assert.deepEqual(getDrawerState(), { open: true, pane: "test:workspace-timing" });
    assert.equal(notifications, 1);
    assertCoreMatchesFrontend();

    // A blank id never reaches the drawer and performs no write.
    assert.equal(workspace.openDrawerPane("   "), false);
    assert.equal(notifications, 1);
    assert.deepEqual(getDrawerState(), { open: true, pane: "test:workspace-timing" });

    // An unknown pane is rejected by the same write entry and performs no write.
    assert.equal(workspace.openDrawerPane("missing"), false);
    assert.equal(notifications, 1);
    assert.deepEqual(getDrawerState(), { open: true, pane: "test:workspace-timing" });
    assertCoreMatchesFrontend();

    // Closing keeps the last page selected, and the core read follows it.
    closeDrawer();
    assert.deepEqual(getDrawerState(), { open: false, pane: "test:workspace-timing" });
    assert.equal(notifications, 2);
    assertCoreMatchesFrontend();

    toggleDrawerPane("test:workspace-lines");
    assert.deepEqual(getDrawerState(), { open: true, pane: "test:workspace-lines" });
    assert.equal(notifications, 3);
    assertCoreMatchesFrontend();
  } finally {
    unsubscribe();
    closeDrawer();
    disposeLines();
    disposeTiming();
  }
});

test("core exposes only a derived drawer reader, not a second writable copy", () => {
  assert.equal(typeof coreDrawer.readDrawerPane, "function");
  assert.equal(typeof coreDrawer.bindDrawerPaneReader, "function");
  assert.equal("setDrawerPane" in coreDrawer, false);
  assert.equal("drawerPane" in coreDrawer, false);
  assertCoreMatchesFrontend();
});
