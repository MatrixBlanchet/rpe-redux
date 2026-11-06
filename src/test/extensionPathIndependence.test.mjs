/**
 * Verifies that the final Extension state depends on the enabled set and bytes,
 * not on the user's path through disable, reload, or unload.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { ExtensionRuntime } from "../core/extensions/extensionRuntime.ts";
import {
  readExtensionOrder,
  readPersistedExtensionState,
} from "../core/extensions/extensionRuntimeSupport.ts";
import { PreferenceStore } from "../core/state/preferences.ts";

/** Unique suffix so process-wide registries never collide across tests. */
function suffix() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/** Build one inert code package manifest. */
function manifest(id) {
  return {
    kind: "extension",
    id,
    name: id,
    version: "1.0.0",
    engines: { "rpe-redux": 1 },
    entry: "index.js",
    capabilities: [],
  };
}

/** The loader used by every path; the fake sandbox never evaluates it. */
async function loader() {
  return { source: "export default { activate() {} };" };
}

/** Build a runtime whose sandboxes have no side effects. */
function newRuntime(store) {
  return new ExtensionRuntime({
    preferenceStore: store,
    hostVersion: "1.0.0",
    sandboxFactory: () => ({ start: async () => {}, dispose: () => {} }),
  });
}

/** Run one activation path and return its observable final state. */
async function runPath(id, steps) {
  const store = new PreferenceStore();
  const runtime = newRuntime(store);
  const packageManifest = manifest(id);
  assert.equal(runtime.loadManifest(packageManifest, loader).ok, true);
  try {
    for (const step of steps) {
      await step(runtime, id);
    }
    const current = runtime.list().find((entry) => entry.manifest.id === id);
    return {
      status: current?.status,
      consent: current?.consent,
      persisted: readPersistedExtensionState(packageManifest, store),
      order: readExtensionOrder(store),
    };
  } finally {
    runtime.uninstall(id);
  }
}

const enable = (runtime, id) => runtime.enableAsync(id, true);
const disable = (runtime, id) => runtime.disable(id);
const languageReload = (runtime) => runtime.reloadEnabled();
const unloadReload = async (runtime, id) => {
  assert.equal(runtime.unload(id).ok, true);
  assert.equal(runtime.loadManifest(manifest(id), loader).ok, true);
  await runtime.restorePersisted();
};

test("enable, re-enable, language reload, and unload reload reach the same state", async () => {
  const id = `test.path.${suffix()}`;
  const cold = await runPath(id, [enable]);
  const reenabled = await runPath(id, [enable, disable, enable]);
  const reloaded = await runPath(id, [enable, languageReload]);
  const unloaded = await runPath(id, [enable, unloadReload]);

  for (const [name, state] of Object.entries({ reenabled, reloaded, unloaded })) {
    assert.deepEqual(state, cold, `${name} diverged from a cold enable`);
  }
  assert.equal(cold.status, "enabled");
  assert.equal(cold.consent, "current");
  assert.equal(cold.persisted.enabled, true);
  assert.deepEqual(cold.order, [id]);
});
