/** Exercise update-package progress and cancellation through a mock downloader. */
import assert from "node:assert/strict";
import test from "node:test";
import { dismissLongTask, getLongTasks, removeLongTask } from "../../../core/state/longTasks.ts";
import { startDownloadTask } from "../../../core/state/downloadTask.ts";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

/** Wait until a retained task satisfies a test predicate. */
async function waitForTask(predicate) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const task = getLongTasks().find((item) => predicate(item));
    if (task) {
      return task;
    }
    await tick();
  }
  assert.fail("mock download task did not reach the expected state");
}

test("mock update download reports byte progress and completes", async () => {
  const handle = startDownloadTask({
    label: "mock.update",
    stage: "mock.starting",
    run: async (_signal, report) => {
      report("mock.downloading", 0.25);
      await tick();
      report("mock.downloading", 0.75);
      await tick();
      report("mock.downloading", 1);
      return "2.0.0";
    },
  });
  const progress = await waitForTask((task) => task.id === handle.id && task.progress === 0.75);
  assert.equal(progress.status, "running");
  assert.deepEqual(await handle.done, { status: "completed", version: "2.0.0" });
  await tick();
  assert.equal(getLongTasks().find((task) => task.id === handle.id)?.status, "completed");
  dismissLongTask(handle.id);
});

test("cancelling a mock update download reports cancellation", async () => {
  const handle = startDownloadTask({
    label: "mock.update",
    stage: "mock.starting",
    run: async (signal, report) => {
      report("mock.downloading", 0.4);
      await new Promise((resolve, reject) => {
        const timer = setTimeout(resolve, 1000);
        signal.addEventListener(
          "abort",
          () => {
            clearTimeout(timer);
            reject(new Error("mock cancelled"));
          },
          { once: true },
        );
      });
      return "2.0.0";
    },
  });
  await waitForTask((task) => task.id === handle.id && task.progress === 0.4);
  removeLongTask(handle.id);
  assert.deepEqual(await handle.done, { status: "cancelled" });
  await tick();
  assert.equal(
    getLongTasks().some((task) => task.id === handle.id),
    false,
  );
});
