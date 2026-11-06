/** Verifies the host timer wrapper shared with the sandbox bridge keeps its limits. */
import assert from "node:assert/strict";
import test from "node:test";
import {
  EXTENSION_TIMER_LIMITS,
  ExtensionRuntime,
} from "../../../core/extensions/extensionRuntime.ts";
import { PreferenceStore } from "../../../core/state/preferences.ts";

test("the sandbox timer contract stays at 64 handles and a 16 ms floor", () => {
  assert.equal(EXTENSION_TIMER_LIMITS.maxTimers, 64);
  assert.equal(EXTENSION_TIMER_LIMITS.minIntervalMs, 16);
});

test("the host timer wrapper enforces the sandbox budget and interval floor", async () => {
  const calls = [];
  let nextHandle = 0;
  const timers = {
    setTimeout(_callback, delay) {
      const handle = ++nextHandle;
      calls.push({ kind: "timeout", delay, handle });
      return handle;
    },
    setInterval(_callback, delay) {
      const handle = ++nextHandle;
      calls.push({ kind: "interval", delay, handle });
      return handle;
    },
    requestAnimationFrame(_callback) {
      const handle = ++nextHandle;
      calls.push({ kind: "frame", delay: 0, handle });
      return handle;
    },
    clearTimeout(handle) {
      calls.push({ kind: "clearTimeout", delay: 0, handle });
    },
    clearInterval(handle) {
      calls.push({ kind: "clearInterval", delay: 0, handle });
    },
    cancelAnimationFrame(handle) {
      calls.push({ kind: "cancelAnimationFrame", delay: 0, handle });
    },
  };
  const runtime = new ExtensionRuntime({
    timers,
    preferenceStore: new PreferenceStore(),
    hostVersion: "1.0.0",
  });
  let captured = null;
  let disposed = false;
  runtime.setSandboxFactory((input) => {
    captured = input.context;
    return {
      start: async () => {},
      dispose: () => {
        disposed = true;
      },
    };
  });

  const manifest = {
    kind: "extension",
    id: "test.timer-limits",
    name: "Timer limits",
    version: "1.0.0",
    engines: { "rpe-redux": 1 },
    entry: "index.js",
    capabilities: ["timers"],
  };
  const loaded = runtime.loadManifest(manifest, async () => ({
    source: "export default { activate() {} };",
  }));
  assert.equal(loaded.ok, true, JSON.stringify(loaded));
  const enabled = await runtime.enableAsync(manifest.id, true);
  assert.equal(enabled.ok, true, JSON.stringify(enabled));
  assert.ok(captured instanceof Object, "sandbox factory did not receive a host context");

  const context = /** @type {ExtensionHostContext} */ (captured);
  const handles = [];
  for (let index = 0; index < EXTENSION_TIMER_LIMITS.maxTimers; index += 1) {
    handles.push(context.timers.setTimeout(() => {}, 1_000));
  }
  assert.throws(
    () => context.timers.setTimeout(() => {}, 1_000),
    new RegExp(`timer limit reached: ${EXTENSION_TIMER_LIMITS.maxTimers}`, "u"),
  );
  for (const handle of handles) {
    context.timers.clearTimeout?.(handle);
  }

  const interval = context.timers.setInterval(() => {}, 1);
  const scheduledInterval = calls.filter((entry) => entry.kind === "interval").at(-1);
  assert.equal(scheduledInterval?.delay, EXTENSION_TIMER_LIMITS.minIntervalMs);

  const frame = context.timers.requestAnimationFrame(() => {});
  context.timers.cancelAnimationFrame(frame);
  context.timers.clearInterval(interval);

  const disabled = runtime.disable(manifest.id);
  assert.equal(disabled.ok, true, JSON.stringify(disabled));
  assert.equal(disposed, true, "disabling the package did not dispose its sandbox");
});
