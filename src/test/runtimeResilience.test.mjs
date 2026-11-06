/** Exercises shared retry pacing, queue bounds, and heartbeat timing. */
import assert from "node:assert/strict";
import test from "node:test";
import { Backoff, backoffDelay } from "../core/runtime/backoff.ts";
import { Heartbeat } from "../core/runtime/heartbeat.ts";
import {
  TaskAbortedError,
  TaskQueue,
  TaskQueueFullError,
  TaskTimeoutError,
} from "../core/runtime/taskQueue.ts";

test("backoff doubles to its cap and resets after a healthy connection", () => {
  const policy = { initialMs: 100, maxMs: 350, factor: 2, jitter: 0 };
  assert.equal(backoffDelay(0, policy), 100);
  assert.equal(backoffDelay(1, policy), 200);
  assert.equal(backoffDelay(2, policy), 350);
  assert.equal(backoffDelay(-4, policy), 100);
  const backoff = new Backoff(policy);
  assert.equal(backoff.next(), 100);
  assert.equal(backoff.next(), 200);
  assert.equal(backoff.attempts, 2);
  backoff.reset();
  assert.equal(backoff.next(), 100);
});

test("jitter stays inside the policy window", () => {
  const policy = { initialMs: 1000, maxMs: 1000, factor: 1, jitter: 0.2 };
  assert.equal(
    backoffDelay(0, policy, () => 0),
    800,
  );
  assert.equal(
    backoffDelay(0, policy, () => 1),
    1000,
  );
  assert.equal(
    backoffDelay(0, policy, () => 0.5),
    1000,
  );
});

test("priority selects high work first while preserving FIFO within a class", async () => {
  const queue = new TaskQueue({ concurrency: 1 });
  const order = [];
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const blocker = queue.run(async () => {
    order.push("block");
    await gate;
    order.push("unblock");
  });
  const low = queue.run(async () => order.push("low"), { priority: "low" });
  const normal = queue.run(async () => order.push("normal"), { priority: "normal" });
  const high = queue.run(async () => order.push("high"), { priority: "high" });
  release();
  await Promise.all([blocker, low, normal, high]);
  assert.deepEqual(order, ["block", "unblock", "high", "normal", "low"]);
  queue.dispose();
});

test("a keyed task is shared and removed once it settles", async () => {
  const queue = new TaskQueue({ concurrency: 2 });
  let calls = 0;
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const first = queue.run(
    async () => {
      calls += 1;
      await gate;
      return "first";
    },
    { key: "project:list" },
  );
  const second = queue.run(
    async () => {
      calls += 1;
      return "second";
    },
    { key: "project:list" },
  );
  assert.equal(first, second);
  release();
  assert.equal(await first, "first");
  assert.equal(calls, 1);
  assert.equal(await queue.run(async () => "next", { key: "project:list" }), "next");
  queue.dispose();
});

test("a queued task aborts without consuming a slot", async () => {
  const queue = new TaskQueue({ concurrency: 1 });
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const blocker = queue.run(() => gate);
  const controller = new AbortController();
  const cancelled = queue.run(async () => "never", {
    priority: "critical",
    signal: controller.signal,
  });
  controller.abort();
  await assert.rejects(cancelled, TaskAbortedError);
  release();
  await blocker;
  assert.equal(await queue.run(async () => "after"), "after");
  queue.dispose();
});

test("a running task times out and keeps its slot until it settles", async () => {
  const queue = new TaskQueue({ concurrency: 1 });
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const timedOut = queue.run(
    async (signal) => {
      await gate;
      if (signal.aborted) {
        throw new TaskAbortedError();
      }
    },
    { timeoutMs: 5 },
  );
  await assert.rejects(timedOut, TaskTimeoutError);
  assert.equal(queue.active, 1);
  release();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(queue.active, 0);
  queue.dispose();
});

test("the queue rejects work above its bound", async () => {
  const queue = new TaskQueue({ concurrency: 1, maxQueued: 1 });
  const first = queue.run(() => new Promise(() => {}));
  await assert.rejects(
    queue.run(async () => undefined),
    TaskQueueFullError,
  );
  queue.dispose();
  first.catch(() => undefined);
});

test("heartbeat pings while messages arrive and stops on silence", () => {
  let now = 0;
  let tick = () => {};
  const timers = {
    now: () => now,
    setInterval: (callback) => {
      tick = callback;
      return 1;
    },
    clearInterval: () => {},
  };
  let pings = 0;
  let timeouts = 0;
  const heartbeat = new Heartbeat({
    intervalMs: 100,
    timeoutMs: 50,
    onPing: () => {
      pings += 1;
    },
    onTimeout: () => {
      timeouts += 1;
    },
    timers,
  });
  heartbeat.start();
  now = 100;
  heartbeat.touch();
  tick();
  assert.equal(pings, 1);
  assert.equal(timeouts, 0);
  now = 200;
  tick();
  assert.equal(pings, 2);
  assert.equal(timeouts, 0);
  now = 260;
  tick();
  assert.equal(timeouts, 1);
  assert.equal(heartbeat.running, false);
});
