/** Recovery ownership, retention limit, and cancellation through the Tauri store. */
import assert from "node:assert/strict";
import test from "node:test";
import { createChart } from "../core/global/chart/chart.ts";
import { TauriDocumentStore } from "../core/platform/desktop/documentStore.ts";
import { defineValue, values } from "../core/state/values.ts";

/** Capture Tauri commands and optionally fail one command. */
function captureTauri(failCommand) {
  const calls = [];
  globalThis.window = {
    __TAURI_INTERNALS__: {
      invoke: async (command, args) => {
        calls.push({ command, args });
        if (command === failCommand) {
          throw new Error(`simulated ${command} failure`);
        }
        return command === "begin_recovery" ? "recovery-session" : null;
      },
    },
  };
  return calls;
}

/** Install an in-memory localStorage that survives store construction. */
function installStorage() {
  const cells = new Map();
  globalThis.localStorage = {
    getItem: (key) => (cells.has(key) ? cells.get(key) : null),
    setItem: (key, value) => cells.set(key, value),
  };
  return cells;
}

/** Define the retention setting once for the whole test process. */
function ensureLimitSetting() {
  if (!values.has("autosave-limit")) {
    defineValue({ id: "autosave-limit", initial: 10 });
  }
}

test("pathless recovery ids stay stable and detached rooms reuse one family", () => {
  const cells = installStorage();
  const first = new TauriDocumentStore();
  const second = new TauriDocumentStore();
  assert.ok(cells.size > 0, "the untitled family must be persisted");
  assert.equal(first.recoveryId, second.recoveryId);

  first.detachRecoveryTarget();
  const detached = first.recoveryId;
  const other = new TauriDocumentStore();
  other.detachRecoveryTarget();
  assert.equal(other.recoveryId, detached);
  assert.notEqual(detached, second.recoveryId);
});

test("the configured autosave limit reaches the native recovery request", async () => {
  ensureLimitSetting();
  values.set("autosave-limit", 3);
  const calls = captureTauri();
  const store = new TauriDocumentStore(async (chart) => JSON.stringify(chart));

  await store.recover(createChart(), new Map());

  const begin = calls.find((call) => call.command === "begin_recovery");
  assert.ok(begin, "recover must start a native recovery session");
  assert.equal(begin.args.request.limit, 3);
});

test("a limit outside the native range is clamped", async () => {
  ensureLimitSetting();
  const calls = captureTauri();
  const store = new TauriDocumentStore(async (chart) => JSON.stringify(chart));

  values.set("autosave-limit", 1000);
  await store.recover(createChart(), new Map());
  values.set("autosave-limit", 0);
  await store.recover(createChart(), new Map());

  const limits = calls
    .filter((call) => call.command === "begin_recovery")
    .map((call) => call.args.request.limit);
  assert.deepEqual(limits, [100, 1]);
});

test("a failed asset write cancels the session and never finishes it", async () => {
  const calls = captureTauri("write_recovery_asset");
  const store = new TauriDocumentStore(async (chart) => JSON.stringify(chart));

  await assert.rejects(
    store.recover(createChart(), new Map([["song.ogg", new Uint8Array([1, 2, 3])]])),
    /simulated write_recovery_asset failure/,
  );

  assert.ok(calls.some((call) => call.command === "cancel_recovery"));
  assert.ok(!calls.some((call) => call.command === "finish_recovery"));
});
