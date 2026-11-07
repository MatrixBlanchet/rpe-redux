/** Verifies that update handoff reads live document and background-task state. */
import assert from "node:assert/strict";
import test from "node:test";
import { connectDocumentApi } from "../../../core/edit/document/api.ts";
import { startLongTask, dismissLongTask } from "../../../core/state/longTasks.ts";
import { updateSafetyBlock } from "../../../frontend/screens/settings/updates/updateStore.ts";

test("blocks a missing runtime, an unsaved document, and running jobs", async () => {
  assert.equal(updateSafetyBlock(), "save-first");
  let dirty = false;
  const disconnect = connectDocumentApi({
    descriptor: () => ({ status: "open", path: null, name: "test", format: "memory" }),
    chart: () => null,
    dirty: () => dirty,
    create: async () => {},
    openPath: async () => {},
    openBytes: async () => "loaded",
    save: async () => "saved",
    close: async () => {},
  });
  try {
    assert.equal(updateSafetyBlock(), null);
    dirty = true;
    assert.equal(updateSafetyBlock(), "save-first");
    dirty = false;
    let finish;
    const waiting = new Promise((resolve) => {
      finish = resolve;
    });
    const id = startLongTask({ label: "job", run: async () => waiting });
    assert.equal(updateSafetyBlock(), "tasks-active");
    finish();
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(updateSafetyBlock(), null);
    dismissLongTask(id);
  } finally {
    disconnect();
  }
});
