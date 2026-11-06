/**
 * Verifies reload, unload, update, cycle, and dependency semantics that decide
 * the final runtime state of a packaged Extension.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { redux } from "../core/api/index.ts";
import { connectExtensionApi } from "../core/extensions/extensionApi.ts";
import { ExtensionRuntime } from "../core/extensions/extensionRuntime.ts";
import {
  hasDisabledExtensionVersion,
  hasPersistedExtensionState,
  readExtensionOrder,
  readPersistedExtensionState,
} from "../core/extensions/extensionRuntimeSupport.ts";
import { PREFERENCE_SECTIONS, PreferenceStore, preferences } from "../core/state/preferences.ts";
import { values as valueRegistry } from "../core/state/values.ts";

connectExtensionApi(redux);

/** Unique suffix so process-wide registries never collide across tests. */
function suffix() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/** Build one code package manifest with the requested dependencies. */
function manifest(id, dependencies = [], version = "1.0.0", capabilities = []) {
  return {
    kind: "extension",
    id,
    name: id,
    version,
    engines: { "rpe-redux": 1 },
    entry: "index.js",
    capabilities,
    ...(dependencies.length > 0 ? { dependencies } : {}),
  };
}

/** A loader that returns inert entry text; the fake sandbox never evaluates it. */
async function loader() {
  return { source: "export default { activate() {} };" };
}

/** Build a runtime whose sandboxes only record lifecycle events. */
function runtimeWith(store, hooks = {}) {
  return new ExtensionRuntime({
    preferenceStore: store,
    hostVersion: "1.0.0",
    sandboxFactory: (input) => {
      hooks.onStart?.(input);
      return {
        start: async () => {
          hooks.onStarted?.(input);
        },
        dispose: () => {
          hooks.onDispose?.(input);
        },
      };
    },
  });
}

/** Poll a microtask-sized condition without depending on wall-clock timing. */
async function waitFor(predicate, label) {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    if (predicate()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  assert.fail(`Timed out waiting for ${label}`);
}

/** The current snapshot for one id. */
function snapshot(runtime, id) {
  return runtime.list().find((entry) => entry.manifest.id === id);
}

test("unload keeps consent, enablement, and order; uninstall clears them", async () => {
  const id = `test.unload.${suffix()}`;
  const packageManifest = manifest(id);
  const store = new PreferenceStore();
  const runtime = runtimeWith(store);
  runtime.loadManifest(packageManifest, loader);
  try {
    const enabled = await runtime.enableAsync(id, true);
    assert.equal(enabled.ok, true, JSON.stringify(enabled));
    assert.deepEqual(readPersistedExtensionState(packageManifest, store), {
      acknowledged: true,
      enabled: true,
      fingerprint: null,
    });
    assert.deepEqual(readExtensionOrder(store), [id]);

    const unloaded = runtime.unload(id);
    assert.equal(unloaded.ok, true, JSON.stringify(unloaded));
    assert.deepEqual(
      readPersistedExtensionState(packageManifest, store),
      { acknowledged: true, enabled: true, fingerprint: null },
      "unload cleared consent or the enabled flag",
    );
    assert.deepEqual(readExtensionOrder(store), [id], "unload dropped the order entry");

    const reloaded = runtime.loadManifest(packageManifest, loader);
    assert.equal(reloaded.ok, true, JSON.stringify(reloaded));
    await runtime.restorePersisted();
    assert.equal(snapshot(runtime, id)?.status, "enabled");

    const uninstalled = runtime.uninstall(id);
    assert.equal(uninstalled.ok, true, JSON.stringify(uninstalled));
    assert.deepEqual(readPersistedExtensionState(packageManifest, store), {
      acknowledged: false,
      enabled: false,
      fingerprint: null,
    });
    assert.deepEqual(readExtensionOrder(store), [], "uninstall kept the order entry");
  } finally {
    runtime.uninstall(id);
  }
});

test("unload keeps a disabled built-in's state so discovery cannot re-enable it", async () => {
  const id = `builtin.unload.${suffix()}`;
  const packageManifest = manifest(id);
  const store = new PreferenceStore();
  const runtime = runtimeWith(store);
  runtime.loadManifest(packageManifest, loader);
  try {
    assert.equal((await runtime.enableAsync(id, true)).ok, true);
    assert.equal(runtime.disable(id).ok, true);
    assert.equal(runtime.unload(id).ok, true);
    assert.equal(hasPersistedExtensionState(packageManifest, store), true);
    assert.equal(hasDisabledExtensionVersion(packageManifest, store), true);
  } finally {
    runtime.uninstall(id);
  }
});

test("changed bytes stay disabled until the new fingerprint is acknowledged", async () => {
  const id = `test.consent.update.${suffix()}`;
  const store = new PreferenceStore();
  const runtime = runtimeWith(store);
  const packageManifest = manifest(id);
  runtime.loadManifest(packageManifest, loader, { fingerprint: "old-bytes" });
  try {
    assert.equal((await runtime.enableAsync(id, true)).ok, true);
    assert.equal(runtime.unload(id).ok, true);

    assert.equal(
      runtime.loadManifest(packageManifest, loader, { fingerprint: "new-bytes" }).ok,
      true,
    );
    await runtime.restorePersisted();
    const reloaded = snapshot(runtime, id);
    assert.equal(reloaded?.status, "loaded");
    assert.equal(reloaded?.consent, "stale");

    const blocked = await runtime.enableAsync(id, false);
    assert.equal(blocked.ok, false);
    if (!blocked.ok) {
      assert.equal(blocked.code, "consentStale");
    }

    const accepted = await runtime.enableAsync(id, true);
    assert.equal(accepted.ok, true, JSON.stringify(accepted));
    assert.equal(snapshot(runtime, id)?.consent, "current");
  } finally {
    runtime.uninstall(id);
  }
});

test("updating a disabled package keeps it disabled across unload and reload", async () => {
  const id = `test.update.disabled.${suffix()}`;
  const store = new PreferenceStore();
  const runtime = runtimeWith(store);
  runtime.loadManifest(manifest(id, [], "1.0.0"), loader);
  try {
    const enabled = await runtime.enableAsync(id, true);
    assert.equal(enabled.ok, true, JSON.stringify(enabled));
    const disabled = runtime.disable(id);
    assert.equal(disabled.ok, true, JSON.stringify(disabled));
    assert.equal(readPersistedExtensionState(manifest(id), store).enabled, false);

    assert.equal(runtime.unload(id).ok, true);
    const updated = manifest(id, [], "1.1.0");
    assert.equal(runtime.loadManifest(updated, loader).ok, true);
    await runtime.restorePersisted();
    const current = snapshot(runtime, id);
    assert.equal(current?.status, "loaded");
    assert.equal(readPersistedExtensionState(updated, store).enabled, false);
  } finally {
    runtime.uninstall(id);
  }
});

test("an explicit reload re-reads the entry and keeps an enabled package enabled", async () => {
  const id = `test.reload.enabled.${suffix()}`;
  const store = new PreferenceStore();
  let loads = 0;
  const runtime = new ExtensionRuntime({
    preferenceStore: store,
    hostVersion: "1.0.0",
    sandboxFactory: () => ({
      start: async () => {},
      dispose: () => {},
    }),
  });
  const entryLoader = async () => {
    loads += 1;
    return { source: `export default { activate() {} }; // ${loads}` };
  };
  runtime.loadManifest(manifest(id), entryLoader);
  try {
    assert.equal((await runtime.enableAsync(id, true)).ok, true);
    assert.equal(loads, 1);

    // This is what the loader's forced refresh does for one package.
    runtime.suspendDependents(id);
    assert.equal(runtime.unload(id).ok, true);
    assert.equal(runtime.loadManifest(manifest(id), entryLoader).ok, true);
    await runtime.restorePersisted();

    assert.equal(loads, 2, "the explicit reload reused the cached entry source");
    assert.equal(snapshot(runtime, id)?.status, "enabled");
    assert.deepEqual(readExtensionOrder(store), [id]);
  } finally {
    runtime.uninstall(id);
  }
});

test("a dependency update suspends dependents and restores them afterwards", async () => {
  const dependency = `test.dependency.${suffix()}`;
  const dependent = `test.dependent.${suffix()}`;
  const store = new PreferenceStore();
  const runtime = runtimeWith(store);
  runtime.loadManifest(manifest(dependency), loader);
  runtime.loadManifest(manifest(dependent, [dependency]), loader);
  try {
    assert.equal((await runtime.enableAsync(dependency, true)).ok, true);
    assert.equal((await runtime.enableAsync(dependent, true)).ok, true);

    const suspended = runtime.suspendDependents(dependency, "Dependency is updating");
    assert.deepEqual(suspended, [dependent]);
    const suspendedSnapshot = snapshot(runtime, dependent);
    assert.equal(suspendedSnapshot?.status, "disabled");
    assert.equal(suspendedSnapshot?.error, "Dependency is updating");
    assert.equal(
      readPersistedExtensionState(manifest(dependent), store).enabled,
      true,
      "suspension must keep the dependent's persisted enabled flag",
    );

    assert.equal(runtime.unload(dependency).ok, true);
    assert.equal(runtime.loadManifest(manifest(dependency), loader).ok, true);
    await runtime.restorePersisted();

    assert.equal(snapshot(runtime, dependency)?.status, "enabled");
    assert.equal(snapshot(runtime, dependent)?.status, "enabled");
    assert.equal(snapshot(runtime, dependent)?.error, null);
  } finally {
    runtime.uninstall(dependent);
    runtime.uninstall(dependency);
  }
});

test("an enabled dependent blocks unload until it is suspended", async () => {
  const dependency = `test.block.${suffix()}`;
  const dependent = `test.blocker.${suffix()}`;
  const store = new PreferenceStore();
  const runtime = runtimeWith(store);
  runtime.loadManifest(manifest(dependency), loader);
  runtime.loadManifest(manifest(dependent, [dependency]), loader);
  try {
    assert.equal((await runtime.enableAsync(dependency, true)).ok, true);
    assert.equal((await runtime.enableAsync(dependent, true)).ok, true);
    const blocked = runtime.unload(dependency);
    assert.equal(blocked.ok, false);
    assert.equal(blocked.code, "dependentEnabled");

    runtime.suspendDependents(dependency);
    assert.equal(runtime.unload(dependency).ok, true);
  } finally {
    runtime.uninstall(dependent);
    runtime.uninstall(dependency);
  }
});

test("uninstall purges a value registered by the active generation", async () => {
  const id = `test.purge.value.${suffix()}`;
  const valueId = `extension.${id}.counter`;
  const store = new PreferenceStore();
  const runtime = new ExtensionRuntime({
    preferenceStore: store,
    hostVersion: "1.0.0",
    sandboxFactory: (input) => ({
      start: async () => {
        const counter = input.context.api.values.define({
          id: "counter",
          initial: 0,
          persist: true,
        });
        counter.set(3);
      },
      dispose: () => {},
    }),
  });
  runtime.loadManifest(manifest(id, [], "1.0.0", ["values"]), loader);
  try {
    assert.equal((await runtime.enableAsync(id, true)).ok, true);
    assert.equal(valueRegistry.has(valueId), true);
    assert.equal(preferences.read(PREFERENCE_SECTIONS.values, {})[valueId], 3);

    const uninstalled = runtime.uninstall(id);
    assert.equal(uninstalled.ok, true, JSON.stringify(uninstalled));
    assert.equal(valueRegistry.has(valueId), false);
    assert.equal(preferences.read(PREFERENCE_SECTIONS.values, {})[valueId], undefined);
  } finally {
    runtime.uninstall(id);
    valueRegistry.purgeOwner(id);
  }
});

test("load rejects a dependency cycle with a stable code and path", async () => {
  const first = `test.cycle.a.${suffix()}`;
  const second = `test.cycle.b.${suffix()}`;
  const store = new PreferenceStore();
  const runtime = runtimeWith(store);
  try {
    assert.equal(runtime.loadManifest(manifest(first, [second]), loader).ok, true);
    const cycled = runtime.loadManifest(manifest(second, [first]), loader);
    assert.equal(cycled.ok, false);
    if (cycled.ok) {
      assert.fail("cycle was accepted");
    }
    assert.equal(cycled.code, "dependencyCycle");
    assert.match(cycled.reason, /->/u);
    assert.equal(
      runtime.list().some((entry) => entry.manifest.id === second),
      false,
    );

    const selfId = `test.cycle.self.${suffix()}`;
    const self = runtime.loadManifest(manifest(selfId, [selfId]), loader);
    assert.equal(self.ok, false);
    if (self.ok) {
      assert.fail("self dependency was accepted");
    }
    assert.equal(self.code, "selfDependency");
  } finally {
    runtime.uninstall(first);
    runtime.uninstall(second);
  }
});

test("the failure budget stops enabled dependents instead of leaving them active", async () => {
  const dependency = `test.failure.dep.${suffix()}`;
  const dependent = `test.failure.use.${suffix()}`;
  const store = new PreferenceStore();
  let report = null;
  const runtime = runtimeWith(store, {
    onStarted: (input) => {
      if (input.manifest.id === dependency) {
        report = input.reportFailure;
      }
    },
  });
  runtime.loadManifest(manifest(dependency), loader);
  runtime.loadManifest(manifest(dependent, [dependency]), loader);
  try {
    assert.equal((await runtime.enableAsync(dependency, true)).ok, true);
    assert.equal((await runtime.enableAsync(dependent, true)).ok, true);
    assert.ok(report, "the fake sandbox did not receive a failure reporter");
    for (let index = 0; index < 5; index += 1) {
      report(new Error(`failure ${index}`), "events.probe");
    }
    await waitFor(
      () =>
        snapshot(runtime, dependency)?.status === "failed" &&
        snapshot(runtime, dependent)?.status === "failed",
      "the failure budget to stop the dependency and its dependent",
    );
    assert.match(snapshot(runtime, dependent)?.error ?? "", /Dependency/u);
  } finally {
    runtime.uninstall(dependent);
    runtime.uninstall(dependency);
  }
});

test("disableAll visits dependents before their dependencies", async () => {
  const dependency = `test.order.dep.${suffix()}`;
  const dependent = `test.order.use.${suffix()}`;
  const store = new PreferenceStore();
  const disposed = [];
  const runtime = runtimeWith(store, {
    onDispose: (input) => disposed.push(input.manifest.id),
  });
  runtime.loadManifest(manifest(dependency), loader);
  runtime.loadManifest(manifest(dependent, [dependency]), loader);
  try {
    assert.equal((await runtime.enableAsync(dependency, true)).ok, true);
    assert.equal((await runtime.enableAsync(dependent, true)).ok, true);
    const results = runtime.disableAll();
    assert.equal(
      results.every((result) => result.ok),
      true,
    );
    assert.deepEqual(disposed, [dependent, dependency]);
  } finally {
    runtime.uninstall(dependent);
    runtime.uninstall(dependency);
  }
});

test("a stale sandbox failure does not consume the new activation budget", async () => {
  const id = `test.stale.${suffix()}`;
  const store = new PreferenceStore();
  const reports = [];
  const runtime = runtimeWith(store, {
    onStarted: (input) => reports.push(input.reportFailure),
  });
  runtime.loadManifest(manifest(id), loader);
  try {
    assert.equal((await runtime.enableAsync(id, true)).ok, true);
    assert.equal(runtime.disable(id).ok, true);
    assert.equal((await runtime.enableAsync(id, true)).ok, true);
    assert.equal(reports.length, 2);

    reports[0](new Error("old generation"), "events.old");
    assert.equal(snapshot(runtime, id)?.failureCount, 0);

    reports[1](new Error("current generation"), "events.current");
    assert.equal(snapshot(runtime, id)?.failureCount, 1);
  } finally {
    runtime.uninstall(id);
  }
});
