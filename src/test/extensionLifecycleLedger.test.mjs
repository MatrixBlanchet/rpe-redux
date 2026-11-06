/**
 * Locks the Extension lifecycle ledger: every host resource an activation
 * creates must disappear when that activation is disabled, while persisted
 * settings and values survive a disable or runtime unload and only an explicit
 * uninstall purges them. Also covers LIFO teardown, repeated load cycles,
 * in-flight cancellation, and a single shared sandbox for concurrent enables.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { redux } from "../core/api/index.ts";
import { connectExtensionApi } from "../core/extensions/extensionApi.ts";
import { extensionRegistry } from "../core/extensions/runtime.ts";
import { ExtensionRuntime } from "../core/extensions/extensionRuntime.ts";
import { PreferenceStore } from "../core/state/preferences.ts";
import {
  createLedgerState,
  createSandboxFactory,
  ledgerSnapshot,
  manifestFor,
  persistedSnapshot,
  uniqueSuffix,
} from "./extensionLifecycleHarness.mjs";

connectExtensionApi(redux);

/** The ledger of an id that has never been enabled. */
const EMPTY_LEDGER = Object.freeze({
  toolbar: [],
  sidebar: [],
  contextMenu: [],
  settingsDefinitions: [],
  settingsNavigations: [],
  shortcutCategories: [],
  shortcuts: [],
  scripts: [],
  values: [],
  styles: 0,
  timers: 0,
  ui: [],
  sandboxes: 0,
  callbacks: 0,
});

/** Build the ledger one full activation of `id` should report. */
function enabledLedger(id) {
  return {
    toolbar: [`extension.${id}.command`],
    sidebar: [`extension.${id}.entry`],
    contextMenu: [`extension.${id}.menu`],
    settingsDefinitions: [`extension.${id}.flag`],
    settingsNavigations: [`extension.${id}.nav`],
    shortcutCategories: [`extension.${id}`, `extension.${id}.probe`].sort(),
    shortcuts: [
      { id: `extension.${id}.probe`, bindings: ["F10"] },
      { id: `extension.${id}.script.script`, bindings: ["F11"] },
    ].sort((left, right) => left.id.localeCompare(right.id)),
    scripts: [`${id}:script`],
    values: [`extension.${id}.flag`, `extension.${id}.counter`].sort(),
    styles: 1,
    timers: 1,
    ui: ["overlay:overlay", "panel:panel", "sidebar:sidebar"],
    sandboxes: 1,
    callbacks: 1,
  };
}

/** Build one runtime wired to the fake host seams. */
function createRuntime(state, options = {}) {
  const store = new PreferenceStore();
  const runtime = new ExtensionRuntime({
    preferenceStore: store,
    hostVersion: "1.0.0",
    styleHost: state.styles.host,
    timers: state.timers.host,
    sandboxFactory: createSandboxFactory(state, options),
  });
  return { runtime, store };
}

/** Load one code manifest whose loader resolves immediately. */
function load(runtime, id) {
  return runtime.loadManifest(manifestFor(id), async () => ({
    source: "export default { activate() {} };",
  }));
}

/** Remove a record and release the fake host after one test. */
function cleanup(runtime, state, id) {
  try {
    if (runtime.list().some((entry) => entry.manifest.id === id)) {
      runtime.uninstall(id);
    }
  } finally {
    state.dispose();
  }
}

test("disable and unload return every registered side effect to baseline", async () => {
  const id = `test.ledger.${uniqueSuffix()}`;
  const state = createLedgerState();
  const { runtime, store } = createRuntime(state);
  try {
    assert.equal(load(runtime, id).ok, true);
    assert.deepEqual(ledgerSnapshot(id, state), EMPTY_LEDGER);

    const first = await runtime.enableAsync(id, true);
    assert.equal(first.ok, true, JSON.stringify(first));
    assert.deepEqual(ledgerSnapshot(id, state), enabledLedger(id));
    assert.equal(extensionRegistry.hasEvent("document:opened"), true);

    const persistedWhileEnabled = persistedSnapshot(id, store);
    assert.ok(persistedWhileEnabled.settings.includes(`extension.${id}.flag`));
    assert.ok(persistedWhileEnabled.values.includes(`extension.${id}.counter`));
    assert.deepEqual(
      persistedWhileEnabled.shortcuts,
      [`extension.${id}.probe`, `extension.${id}.script.script`].sort(),
    );

    assert.equal(runtime.disable(id).ok, true);
    assert.deepEqual(ledgerSnapshot(id, state), EMPTY_LEDGER);
    assert.equal(extensionRegistry.hasEvent("document:opened"), false);
    assert.deepEqual(persistedSnapshot(id, store), persistedWhileEnabled);

    const second = await runtime.enableAsync(id, true);
    assert.equal(second.ok, true, JSON.stringify(second));
    assert.deepEqual(ledgerSnapshot(id, state), enabledLedger(id));
    assert.deepEqual(persistedSnapshot(id, store), persistedWhileEnabled);

    assert.equal(runtime.disable(id).ok, true);
    assert.deepEqual(ledgerSnapshot(id, state), EMPTY_LEDGER);

    assert.equal(runtime.unload(id).ok, true);
    assert.deepEqual(ledgerSnapshot(id, state), EMPTY_LEDGER);
    assert.equal(runtime.list().length, 0);
    assert.deepEqual(
      persistedSnapshot(id, store),
      persistedWhileEnabled,
      "unload changed persisted user state",
    );
    assert.deepEqual(persistedSnapshot(id, store).settings, [`extension.${id}.flag`]);
    assert.deepEqual(persistedSnapshot(id, store).runtimeState, [`extension:${id}@1.0.0`]);
    assert.deepEqual(persistedSnapshot(id, store).order, [id]);
    assert.deepEqual(persistedSnapshot(id, store).values, [`extension.${id}.counter`]);

    assert.equal(load(runtime, id).ok, true);
    const third = await runtime.enableAsync(id, true);
    assert.equal(third.ok, true, JSON.stringify(third));
    assert.deepEqual(ledgerSnapshot(id, state), enabledLedger(id));
    assert.deepEqual(persistedSnapshot(id, store).settings, [`extension.${id}.flag`]);
    assert.deepEqual(persistedSnapshot(id, store).runtimeState, [`extension:${id}@1.0.0`]);
    assert.equal(runtime.disable(id).ok, true);
    assert.deepEqual(ledgerSnapshot(id, state), EMPTY_LEDGER);
  } finally {
    cleanup(runtime, state, id);
  }
});

test("an explicit uninstall purges persisted settings and values", async () => {
  const id = `test.purge.${uniqueSuffix()}`;
  const state = createLedgerState();
  const { runtime, store } = createRuntime(state);
  try {
    assert.equal(load(runtime, id).ok, true);
    const enabled = await runtime.enableAsync(id, true);
    assert.equal(enabled.ok, true, JSON.stringify(enabled));
    const before = persistedSnapshot(id, store);
    assert.deepEqual(before.settings, [`extension.${id}.flag`]);
    assert.deepEqual(before.runtimeState, [`extension:${id}@1.0.0`]);
    assert.deepEqual(before.values, [`extension.${id}.counter`]);

    const uninstalled = runtime.uninstall(id);
    assert.equal(uninstalled.ok, true, JSON.stringify(uninstalled));
    assert.deepEqual(ledgerSnapshot(id, state), EMPTY_LEDGER);
    const after = persistedSnapshot(id, store);
    assert.deepEqual(after.settings, [], "uninstall kept a persisted setting entry");
    assert.deepEqual(after.runtimeState, [], "uninstall kept persisted extension state");
    assert.deepEqual(
      after.values,
      [],
      "uninstall kept a persisted value entry: disable removed the definition before purgeOwner ran",
    );
  } finally {
    cleanup(runtime, state, id);
  }
});

test("scope cleanups run in LIFO order and a late cleanup runs immediately", async () => {
  const id = `test.lifo.${uniqueSuffix()}`;
  const state = createLedgerState();
  const order = [];
  let captured = null;
  const runtime = new ExtensionRuntime({
    preferenceStore: new PreferenceStore(),
    hostVersion: "1.0.0",
    sandboxFactory: (input) => {
      captured = input.context;
      return {
        start: async () => {
          input.context.addCleanup(() => order.push("first"));
          input.context.addCleanup(() => order.push("second"));
          input.context.addCleanup(() => order.push("third"));
        },
        dispose: () => undefined,
      };
    },
  });
  try {
    assert.equal(load(runtime, id).ok, true);
    assert.equal((await runtime.enableAsync(id, true)).ok, true);
    assert.equal(runtime.disable(id).ok, true);
    assert.deepEqual(order, ["third", "second", "first"]);

    assert.ok(captured, "the fake sandbox did not receive an activation context");
    captured.addCleanup(() => order.push("late"));
    assert.deepEqual(order, ["third", "second", "first", "late"]);
  } finally {
    cleanup(runtime, state, id);
  }
});

test("repeated load, enable, and disable cycles do not grow any registry", async () => {
  const id = `test.repeat.${uniqueSuffix()}`;
  const state = createLedgerState();
  const { runtime, store } = createRuntime(state);
  try {
    let expected = null;
    for (let cycle = 0; cycle < 5; cycle += 1) {
      assert.equal(load(runtime, id).ok, true, `load failed in cycle ${cycle}`);
      const enabled = await runtime.enableAsync(id, true);
      assert.equal(enabled.ok, true, JSON.stringify(enabled));
      const current = ledgerSnapshot(id, state);
      expected ??= current;
      assert.deepEqual(current, expected, `ledger grew in cycle ${cycle}`);
      assert.equal(runtime.disable(id).ok, true);
      assert.deepEqual(ledgerSnapshot(id, state), EMPTY_LEDGER, `cycle ${cycle} left resources`);
      assert.equal(runtime.unload(id).ok, true);
      assert.deepEqual(
        ledgerSnapshot(id, state),
        EMPTY_LEDGER,
        `cycle ${cycle} unload left resources`,
      );
    }
    assert.deepEqual(persistedSnapshot(id, store).values, [`extension.${id}.counter`]);
    assert.deepEqual(persistedSnapshot(id, store).settings, [`extension.${id}.flag`]);
    assert.deepEqual(persistedSnapshot(id, store).runtimeState, [`extension:${id}@1.0.0`]);
    assert.deepEqual(persistedSnapshot(id, store).order, [id]);
  } finally {
    cleanup(runtime, state, id);
  }
});

test("disable during a delayed activation disposes the in-flight scope", async () => {
  const id = `test.cancel.disable.${uniqueSuffix()}`;
  const state = createLedgerState();
  let release = null;
  let registered = null;
  const registeredPromise = new Promise((resolve) => {
    registered = resolve;
  });
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const { runtime } = createRuntime(state, {
    afterRegister: async () => {
      registered();
      await gate;
    },
  });
  try {
    assert.equal(load(runtime, id).ok, true);
    const pending = runtime.enableAsync(id, true);
    await registeredPromise;
    const [sandbox] = [...state.sandboxes];
    assert.ok(sandbox, "the delayed activation did not create its sandbox");
    assert.deepEqual(ledgerSnapshot(id, state), enabledLedger(id));

    const disabled = runtime.disable(id);
    assert.equal(disabled.ok, true, JSON.stringify(disabled));
    assert.equal(sandbox.disposed, true, "disable did not dispose the in-flight sandbox");
    assert.deepEqual(ledgerSnapshot(id, state), EMPTY_LEDGER);
    assert.equal(extensionRegistry.hasEvent("document:opened"), false);

    release();
    const result = await pending;
    assert.equal(result.ok, false);
    assert.match(result.reason, /cancelled/u);
    assert.equal(runtime.list().find((entry) => entry.manifest.id === id)?.status, "disabled");
    assert.equal(state.sandboxes.size, 0);
    assert.deepEqual(ledgerSnapshot(id, state), EMPTY_LEDGER);
  } finally {
    release?.();
    cleanup(runtime, state, id);
  }
});

test("unload during entry loading never creates a sandbox", async () => {
  const id = `test.cancel.loader.${uniqueSuffix()}`;
  const state = createLedgerState();
  let release = null;
  let loaded = null;
  const loadedPromise = new Promise((resolve) => {
    loaded = resolve;
  });
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const { runtime } = createRuntime(state);
  try {
    runtime.loadManifest(manifestFor(id), async () => {
      loaded();
      await gate;
      return { source: "export default { activate() {} };" };
    });
    const pending = runtime.enableAsync(id, true);
    await loadedPromise;
    assert.equal(state.sandboxes.size, 0);

    assert.equal(runtime.unload(id).ok, true);
    assert.equal(runtime.list().length, 0);
    release();
    const result = await pending;
    assert.equal(result.ok, false);
    assert.match(result.reason, /cancelled/u);
    assert.equal(state.sandboxes.size, 0, "a cancelled loader still started a sandbox");
    assert.deepEqual(ledgerSnapshot(id, state), EMPTY_LEDGER);
  } finally {
    release?.();
    cleanup(runtime, state, id);
  }
});

test("unload during sandbox start disposes the in-flight scope and leaves no record", async () => {
  const id = `test.cancel.unload.${uniqueSuffix()}`;
  const state = createLedgerState();
  let release = null;
  let registered = null;
  const registeredPromise = new Promise((resolve) => {
    registered = resolve;
  });
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const { runtime } = createRuntime(state, {
    afterRegister: async () => {
      registered();
      await gate;
    },
  });
  try {
    assert.equal(load(runtime, id).ok, true);
    const pending = runtime.enableAsync(id, true);
    await registeredPromise;
    const [sandbox] = [...state.sandboxes];
    assert.ok(sandbox, "the delayed activation did not create its sandbox");

    assert.equal(runtime.unload(id).ok, true);
    assert.equal(sandbox.disposed, true, "unload did not dispose the in-flight sandbox");
    assert.equal(runtime.list().length, 0);
    assert.deepEqual(ledgerSnapshot(id, state), EMPTY_LEDGER);
    assert.equal(extensionRegistry.hasEvent("document:opened"), false);

    release();
    const result = await pending;
    assert.equal(result.ok, false);
    assert.match(result.reason, /cancelled/u);
    assert.equal(state.sandboxes.size, 0);
    assert.deepEqual(ledgerSnapshot(id, state), EMPTY_LEDGER);
  } finally {
    release?.();
    cleanup(runtime, state, id);
  }
});

test("concurrent enableAsync calls share one sandbox and one scope", async () => {
  const id = `test.race.${uniqueSuffix()}`;
  const state = createLedgerState();
  let release = null;
  let created = 0;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const { runtime } = createRuntime(state, {
    register: () => undefined,
    afterRegister: async () => {
      created += 1;
      await gate;
    },
  });
  try {
    assert.equal(load(runtime, id).ok, true);
    const first = runtime.enableAsync(id, true);
    const second = runtime.enableAsync(id, true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(created, 1, "two overlapping enables created two sandboxes");
    assert.equal(state.sandboxes.size, 1);
    release();
    const [left, right] = await Promise.all([first, second]);
    assert.equal(left.ok, true, JSON.stringify(left));
    assert.equal(right.ok, true, JSON.stringify(right));
    assert.equal(created, 1);
    assert.equal(runtime.list().find((entry) => entry.manifest.id === id)?.status, "enabled");
    assert.equal(runtime.disable(id).ok, true);
    assert.deepEqual(ledgerSnapshot(id, state), EMPTY_LEDGER);
  } finally {
    release?.();
    cleanup(runtime, state, id);
  }
});
