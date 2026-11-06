/**
 * Verifies `preview.subscribe` throttles through one shared scheduler.
 *
 * A fake clock drives painted frames, so callback counts, tail delivery, and
 * cancellations are deterministic and do not depend on real timers.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { preview, setPreviewThrottleClockForTests } from "../core/api/preview.ts";
import { connectPreviewApi } from "../core/edit/preview/api.ts";

/** A deterministic timer queue with millisecond time. */
class FakeClock {
  constructor() {
    this.time = 0;
    this.nextHandle = 1;
    this.timers = new Map();
    this.scheduled = 0;
  }

  now() {
    return this.time;
  }

  setTimeout(handler, delayMs) {
    const handle = this.nextHandle++;
    this.scheduled += 1;
    this.timers.set(handle, { at: this.time + delayMs, handler });
    return handle;
  }

  clearTimeout(handle) {
    this.timers.delete(handle);
  }

  get pending() {
    return this.timers.size;
  }

  /** Advance time to `target`, running every timer due on the way in order. */
  advanceTo(target) {
    for (;;) {
      let dueHandle = null;
      let dueAt = Number.POSITIVE_INFINITY;
      for (const [handle, timer] of this.timers) {
        if (timer.at <= target && timer.at < dueAt) {
          dueHandle = handle;
          dueAt = timer.at;
        }
      }
      if (dueHandle === null) {
        break;
      }
      const timer = this.timers.get(dueHandle);
      this.timers.delete(dueHandle);
      this.time = Math.max(this.time, timer.at);
      timer.handler();
    }
    this.time = target;
  }

  advance(ms) {
    this.advanceTo(this.time + ms);
  }
}

/** A preview host that records each painted frame and subscription. */
function createHost() {
  const listeners = new Set();
  let snapshotValue = null;
  let subscriptions = 0;
  return {
    subscribe(listener) {
      subscriptions += 1;
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    snapshot() {
      return snapshotValue;
    },
    /** Paint one frame and notify every host subscriber. */
    push(value) {
      snapshotValue = value;
      for (const listener of [...listeners]) {
        listener(value);
      }
    },
    get subscriptions() {
      return subscriptions;
    },
    get listenerCount() {
      return listeners.size;
    },
  };
}

/** One minimal frozen-snapshot source frame. */
function frame(revision) {
  const rect = { left: 0, top: 0, width: 1280, height: 720 };
  return {
    revision,
    seconds: revision / 60,
    bounds: rect,
    viewport: rect,
    width: 1280,
    height: 720,
    scale: 1,
    scaleX: 1,
    scaleY: 1,
    devicePixelRatio: 1,
    objects: [],
  };
}

/** Run a 60 Hz input stream for one second against one or more subscribers. */
function runStream(subscriberCount, options) {
  const clock = new FakeClock();
  setPreviewThrottleClockForTests(clock);
  const host = createHost();
  const disconnect = connectPreviewApi(host);
  const deliveries = [];
  const stops = [];
  for (let index = 0; index < subscriberCount; index += 1) {
    const seen = [];
    deliveries.push(seen);
    stops.push(preview.subscribe((value) => seen.push(value?.revision ?? null), options));
  }
  for (let revision = 1; revision <= 60; revision += 1) {
    host.push(frame(revision));
    clock.advance(1000 / 60);
  }
  // Flush the final throttle window so the last frame is guaranteed.
  clock.advance(50);
  const stopAll = () => {
    for (const stop of stops.reverse()) {
      stop();
    }
    disconnect();
    setPreviewThrottleClockForTests(null);
  };
  return { clock, host, deliveries, stopAll };
}

test("a 60 Hz input stream delivers at most 31 callbacks per second and keeps the tail", () => {
  const run = runStream(1);
  try {
    const [seen] = run.deliveries;
    assert.ok(seen.length <= 31, `received ${seen.length} callbacks`);
    assert.ok(seen.length >= 29, `received only ${seen.length} callbacks`);
    assert.equal(seen.at(-1), 60, "the last painted frame must reach the subscriber");
    assert.equal(run.clock.pending, 0, "a settled stream must not leave a timer armed");
  } finally {
    run.stopAll();
  }
});

test("unsubscribing stops callbacks and releases the shared host subscription", () => {
  const clock = new FakeClock();
  setPreviewThrottleClockForTests(clock);
  const host = createHost();
  const disconnect = connectPreviewApi(host);
  const seen = [];
  const stop = preview.subscribe((value) => seen.push(value?.revision ?? null));
  try {
    host.push(frame(1));
    clock.advance(40);
    assert.deepEqual(seen, [1]);
    stop();
    assert.equal(clock.pending, 0);
    assert.equal(host.listenerCount, 0);
    host.push(frame(2));
    clock.advance(1000);
    assert.deepEqual(seen, [1], "a cancelled subscription must not receive later frames");
  } finally {
    disconnect();
    setPreviewThrottleClockForTests(null);
  }
});

test("two subscribers share one scheduler and receive identical throttled frames", () => {
  const single = runStream(1);
  const singleScheduleCount = single.clock.scheduled;
  single.stopAll();

  const pair = runStream(2);
  try {
    assert.equal(pair.host.subscriptions, 1, "both subscribers must share one host subscription");
    assert.deepEqual(pair.deliveries[0], pair.deliveries[1]);
    assert.equal(pair.deliveries[0].at(-1), 60);
    assert.equal(
      pair.clock.scheduled,
      singleScheduleCount,
      "a second subscriber must not add its own timer chain",
    );
  } finally {
    pair.stopAll();
  }
});

test("maxHz clamps to 1-60 and non-finite values use the default", () => {
  const fast = runStream(1, { maxHz: 60 });
  try {
    assert.ok(fast.deliveries[0].length >= 50, `received ${fast.deliveries[0].length} callbacks`);
    assert.ok(fast.deliveries[0].length <= 61, `received ${fast.deliveries[0].length} callbacks`);
  } finally {
    fast.stopAll();
  }

  const slow = runStream(1, { maxHz: 0 });
  try {
    assert.ok(slow.deliveries[0].length <= 2, `received ${slow.deliveries[0].length} callbacks`);
  } finally {
    slow.stopAll();
  }

  const fallback = runStream(1, { maxHz: Number.NaN });
  try {
    assert.ok(fallback.deliveries[0].length <= 31, `received ${fallback.deliveries[0].length}`);
  } finally {
    fallback.stopAll();
  }
});
