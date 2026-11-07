/**
 * Pins the one-shot Extension safe-mode request and the startup evidence
 * summarizer. The request must survive a preference attach that replaces the
 * settings section, and exactly one launch must observe it.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  clearExtensionSafeModeRequest,
  consumeExtensionSafeModeRequest,
  readExtensionSafeModeRequest,
  summarizeExtensionStartup,
  writeExtensionSafeModeRequest,
} from "../../../core/extensions/extensionRuntimeSupport.ts";
import { PREFERENCE_SECTIONS, PreferenceStore } from "../../../core/state/preferences.ts";

const REQUEST_KEY = "extension:safe-mode-request";

test("a safe-mode request writes the settings key and both readers agree", () => {
  const store = new PreferenceStore();
  const request = writeExtensionSafeModeRequest(store);

  assert.equal(typeof request.at, "number");
  assert.deepEqual(store.read(PREFERENCE_SECTIONS.settings, {})[REQUEST_KEY], {
    at: request.at,
  });
  assert.deepEqual(readExtensionSafeModeRequest(store), { at: request.at });

  clearExtensionSafeModeRequest(store);
  assert.equal(REQUEST_KEY in store.read(PREFERENCE_SECTIONS.settings, {}), false);
  assert.equal(readExtensionSafeModeRequest(store), null);
});

test("the mirror copy survives a settings section replaced by attach", () => {
  const store = new PreferenceStore();
  const request = writeExtensionSafeModeRequest(store);

  // PreferenceStore.attach() adopts the durable section wholesale; the request
  // must still be visible to the startup pass after that replacement.
  store.write(PREFERENCE_SECTIONS.settings, { "extensions-disclaimer-accepted": true });

  assert.equal(REQUEST_KEY in store.read(PREFERENCE_SECTIONS.settings, {}), false);
  assert.deepEqual(readExtensionSafeModeRequest(store), { at: request.at });
});

test("consume observes the request once and clears every copy", () => {
  const store = new PreferenceStore();
  const request = writeExtensionSafeModeRequest(store);

  assert.deepEqual(consumeExtensionSafeModeRequest(store), { at: request.at });
  assert.equal(readExtensionSafeModeRequest(store), null);
  assert.equal(consumeExtensionSafeModeRequest(store), null);
  assert.equal(REQUEST_KEY in store.read(PREFERENCE_SECTIONS.settings, {}), false);
});

test("malformed request values read as absent and are cleared", () => {
  const store = new PreferenceStore();
  store.write(PREFERENCE_SECTIONS.settings, { [REQUEST_KEY]: { at: "yesterday" } });

  assert.equal(readExtensionSafeModeRequest(store), null);
  assert.equal(consumeExtensionSafeModeRequest(store), null);
  assert.equal(REQUEST_KEY in store.read(PREFERENCE_SECTIONS.settings, {}), false);
});

test("startup summary names failures and excludes them from candidates", () => {
  const snapshots = [
    {
      manifest: { id: "ext.one", name: "One", version: "1.0.0" },
      status: "enabled",
    },
    {
      manifest: { id: "ext.two", name: "Two", version: "2.0.0" },
      status: "failed",
    },
    {
      manifest: { id: "ext.three", name: "Three", version: "3.0.0" },
      status: "loaded",
    },
  ];
  const results = [
    { ok: false, extensionId: "ext.two", reason: "activation threw" },
    { ok: true, status: "enabled" },
  ];

  const summary = summarizeExtensionStartup(results, snapshots);

  assert.deepEqual(summary.failures, [
    {
      id: "ext.two",
      name: "Two",
      version: "2.0.0",
      message: "activation threw",
    },
  ]);
  assert.deepEqual(summary.activations, [
    { id: "ext.one", name: "One", version: "1.0.0" },
    { id: "ext.three", name: "Three", version: "3.0.0" },
  ]);
  assert.ok(Object.isFrozen(summary.failures));
  assert.ok(Object.isFrozen(summary.failures[0]));
  assert.ok(Object.isFrozen(summary.activations));
});

test("a failure without a snapshot falls back to the extension id", () => {
  const summary = summarizeExtensionStartup(
    [{ ok: false, extensionId: "ext.broken", reason: "manifest rejected" }],
    [],
  );

  assert.deepEqual(summary.failures, [
    {
      id: "ext.broken",
      name: "ext.broken",
      version: "",
      message: "manifest rejected",
    },
  ]);
  assert.deepEqual(summary.activations, []);
});

test("results without an extension id and successful results add no failure", () => {
  const summary = summarizeExtensionStartup(
    [
      { ok: false, reason: "host-level failure" },
      { ok: true, status: "loaded" },
    ],
    [],
  );

  assert.deepEqual(summary.failures, []);
  assert.deepEqual(summary.activations, []);
});
