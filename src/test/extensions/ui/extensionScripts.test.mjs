/** Verifies data-only packages can register several declarative scripts. */
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { redux } from "../../../core/api/index.ts";
import { connectChartApi } from "../../../core/edit/chart/api.ts";
import { connectSelectionApi } from "../../../core/edit/selection/api.ts";
import { connectTransactionApi } from "../../../core/edit/transaction/service.ts";
import { EditorSession } from "../../../core/edit/session/session.ts";
import { SCRIPT_RUN_TIMEOUT_MS, scriptRegistry } from "../../../core/extensions/scripts.ts";
import { createChart } from "../../../core/global/chart/chart.ts";
import {
  dataOnlyDefinition,
  hasDeclarativeScripts,
  materializeManifest,
  validateDataOnlyManifest,
  validateManifest,
} from "../../../core/extensions/extensionRuntimeSupport.ts";

const manifest = {
  kind: "extension",
  id: "test.recipes",
  name: "Recipes",
  version: "1.0.0",
  engines: { "rpe-redux": 1 },
  capabilities: ["scripts"],
  scripts: [
    {
      id: "first",
      label: { key: "script.first.label" },
      steps: [{ op: "notice", message: "first" }],
    },
    {
      id: "second",
      label: { key: "script.second.label" },
      steps: [{ op: "notice", message: "second" }],
    },
  ],
};

test("a data-only package registers every declared script", () => {
  assert.equal(hasDeclarativeScripts(manifest), true);
  assert.equal(validateDataOnlyManifest(manifest), null);
  const registered = [];
  const definition = dataOnlyDefinition(manifest);
  definition.activate({
    i18n: {
      text: (value) => (typeof value === "string" ? value : value.key),
    },
    scripts: {
      register: (script) => {
        registered.push(script.id);
        return () => {};
      },
    },
    addCleanup: () => {},
  });
  assert.deepEqual(registered, ["first", "second"]);
});

test("duplicate or empty declarative scripts are rejected", () => {
  const duplicate = {
    ...manifest,
    scripts: [manifest.scripts[0], { ...manifest.scripts[1], id: "first" }],
  };
  assert.equal(validateDataOnlyManifest(duplicate)?.code, "entryActivateRequired");

  const empty = {
    ...manifest,
    scripts: [{ ...manifest.scripts[0], steps: [] }],
  };
  assert.equal(validateDataOnlyManifest(empty)?.code, "entryActivateRequired");
});

test("the official built-in package validates after the package cleanup", () => {
  const id = "builtin.official";
  const root = new URL(`../../../assets/extensions/${id}/`, import.meta.url);
  const manifest = JSON.parse(fs.readFileSync(new URL("manifest.json", root), "utf8"));
  const i18n = JSON.parse(fs.readFileSync(new URL("i18n.json", root), "utf8"));
  const materialized = materializeManifest(manifest, i18n);
  assert.equal(validateManifest(materialized, 1), null, id);
  assert.equal(typeof materialized.entry, "string");
});

/** Build a minimal manifest the script registry and script context accept. */
function manifestFor(owner) {
  return {
    kind: "extension",
    id: owner,
    name: owner,
    version: "1.0.0",
    engines: { "rpe-redux": 1 },
    capabilities: [],
  };
}

/** Bind the editor handles a code script needs while it builds its context. */
function bindEditor() {
  const session = new EditorSession(createChart());
  const disconnects = [
    connectChartApi({ chart: () => session.chart }),
    connectSelectionApi({ session: () => session }),
    connectTransactionApi({ session: () => session }),
  ];
  return () => {
    for (const disconnect of disconnects.reverse()) {
      disconnect();
    }
  };
}

/** A process-unique owner id so tests never share registry entries. */
function uniqueOwner(label) {
  return `test.${label}.${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

test("a hanging script body reports scriptTimeout once and later runs still work", async () => {
  assert.equal(SCRIPT_RUN_TIMEOUT_MS, 30_000);
  const disconnect = bindEditor();
  const owner = uniqueOwner("timeout");
  const failures = [];
  const signal = new AbortController().signal;
  let entered = false;
  const disposeHanging = scriptRegistry.register(
    owner,
    manifestFor(owner),
    {
      id: "hang",
      label: "Hang",
      async run() {
        entered = true;
        await new Promise(() => {});
      },
    },
    signal,
    undefined,
    () => redux,
    (error, action) => failures.push({ error, action }),
  );
  const disposeNormal = scriptRegistry.register(
    owner,
    manifestFor(owner),
    { id: "ok", label: "Ok", run() {} },
    signal,
    undefined,
    () => redux,
  );
  try {
    const timedOut = await scriptRegistry.run(`${owner}:hang`, undefined, { timeoutMs: 25 });
    assert.equal(entered, true);
    assert.equal(timedOut.ok, false);
    assert.match(timedOut.reason, /^scriptTimeout: /);
    assert.equal(failures.length, 1, "a timeout must consume one failure record");
    assert.equal(failures[0].action, "script.hang");
    assert.equal(failures[0].error.code, "scriptTimeout");

    // A long budget proves a successful run clears its timer: a leaked timer
    // would keep the test process alive for a minute.
    const normal = await scriptRegistry.run(`${owner}:ok`, undefined, { timeoutMs: 60_000 });
    assert.deepEqual(normal, { ok: true });

    const again = await scriptRegistry.run(`${owner}:hang`, undefined, { timeoutMs: 25 });
    assert.equal(again.ok, false);
    assert.match(again.reason, /^scriptTimeout: /);
    assert.equal(failures.length, 2, "a later run must report its own failure");
  } finally {
    disposeNormal();
    disposeHanging();
    disconnect();
  }
});

test("aborting a package mid-run cancels without reporting a timeout", async () => {
  const disconnect = bindEditor();
  const owner = uniqueOwner("cancel");
  const controller = new AbortController();
  const failures = [];
  let markStarted;
  const started = new Promise((resolve) => {
    markStarted = resolve;
  });
  const dispose = scriptRegistry.register(
    owner,
    manifestFor(owner),
    {
      id: "wait",
      label: "Wait",
      async run() {
        markStarted();
        await new Promise(() => {});
      },
    },
    controller.signal,
    undefined,
    () => redux,
    (error, action) => failures.push({ error, action }),
  );
  try {
    const pending = scriptRegistry.run(`${owner}:wait`, undefined, { timeoutMs: 60_000 });
    await started;
    controller.abort();
    const result = await pending;
    assert.equal(result.ok, false);
    assert.match(result.reason, /cancelled/);
    assert.doesNotMatch(result.reason, /scriptTimeout/);
    assert.equal(failures.length, 0, "cancellation must not consume the failure budget");
  } finally {
    dispose();
    disconnect();
  }
});
