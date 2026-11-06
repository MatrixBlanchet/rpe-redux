/**
 * Verifies the Extension rename migrates stored Mod-era preference keys once,
 * without losing installed-extension settings, consent, order, or keybindings.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  extensionPreferenceStore,
  hasDisabledExtensionVersion,
  hasPersistedExtensionState,
  readExtensionBootMarker,
  readExtensionOrder,
  readPersistedExtensionState,
  writePersistedExtensionState,
} from "../core/extensions/extensionRuntimeSupport.ts";
import { PREFERENCE_SECTIONS, PreferenceStore, preferences } from "../core/state/preferences.ts";
import { defineValue } from "../core/state/values.ts";

const manifest = { id: "test.migrate", version: "1.0.0" };

test("owner settings and values move from mod: to extension: on first read", () => {
  const store = new PreferenceStore();
  store.write(PREFERENCE_SECTIONS.settings, {
    "mod:test.migrate:theme": "dark",
    "mod:test.migrate:volume": "0.5",
    "other:owner:theme": "light",
  });
  const scoped = extensionPreferenceStore(PREFERENCE_SECTIONS.settings, "test.migrate", store);

  assert.equal(scoped.get("theme"), "dark");
  assert.equal(scoped.get("volume"), "0.5");

  let section = store.read(PREFERENCE_SECTIONS.settings, {});
  assert.equal(section["extension:test.migrate:theme"], "dark");
  assert.equal(section["extension:test.migrate:volume"], "0.5");
  assert.equal("mod:test.migrate:theme" in section, false);
  assert.equal("mod:test.migrate:volume" in section, false);
  assert.equal(section["other:owner:theme"], "light");

  scoped.set("theme", "light");
  section = store.read(PREFERENCE_SECTIONS.settings, {});
  assert.equal(section["extension:test.migrate:theme"], "light");
  assert.equal("mod:test.migrate:theme" in section, false);

  scoped.clear();
  section = store.read(PREFERENCE_SECTIONS.settings, {});
  assert.equal("extension:test.migrate:theme" in section, false);
  assert.equal("extension:test.migrate:volume" in section, false);
  assert.equal(section["other:owner:theme"], "light");
});

test("extension order and boot marker migrate from their mod: keys", () => {
  const store = new PreferenceStore();
  store.write(PREFERENCE_SECTIONS.settings, {
    "mod:order": ["a", "b"],
    "mod:boot": { id: "startup", at: 42 },
  });

  assert.deepEqual(readExtensionOrder(store), ["a", "b"]);
  assert.deepEqual(readExtensionBootMarker(store), { id: "startup", at: 42 });

  const section = store.read(PREFERENCE_SECTIONS.settings, {});
  assert.deepEqual(section["extension:order"], ["a", "b"]);
  assert.deepEqual(section["extension:boot"], { id: "startup", at: 42 });
  assert.equal("mod:order" in section, false);
  assert.equal("mod:boot" in section, false);
});

test("persisted consent and disabled state migrate and clear both spellings", () => {
  const store = new PreferenceStore();
  store.write(PREFERENCE_SECTIONS.settings, {
    "mod:test.migrate@1.0.0": {
      acknowledged: true,
      enabled: false,
      fingerprint: "fingerprint",
    },
  });

  assert.equal(hasPersistedExtensionState(manifest, store), true);
  assert.equal(hasDisabledExtensionVersion(manifest, store), true);
  assert.deepEqual(readPersistedExtensionState(manifest, store), {
    acknowledged: true,
    enabled: false,
    fingerprint: "fingerprint",
  });

  let section = store.read(PREFERENCE_SECTIONS.settings, {});
  assert.equal("extension:test.migrate@1.0.0" in section, true);
  assert.equal("mod:test.migrate@1.0.0" in section, false);

  writePersistedExtensionState(
    manifest,
    { acknowledged: false, enabled: true, fingerprint: null },
    store,
  );
  section = store.read(PREFERENCE_SECTIONS.settings, {});
  assert.deepEqual(section["extension:test.migrate@1.0.0"], {
    acknowledged: false,
    enabled: true,
    fingerprint: null,
  });
  assert.equal("mod:test.migrate@1.0.0" in section, false);
});

test("shortcut bindings move from the legacy mod.* storage key once", () => {
  const previous = preferences.read(PREFERENCE_SECTIONS.shortcuts, {});
  try {
    preferences.write(PREFERENCE_SECTIONS.shortcuts, {
      "mod.example.script.hello": ["CTRL+K"],
      keep: ["CTRL+L"],
    });
    const handle = defineValue({
      id: "shortcut:extension.example.script.hello",
      storageKey: "extension.example.script.hello",
      legacyStorageKey: "mod.example.script.hello",
      initial: [],
      persist: PREFERENCE_SECTIONS.shortcuts,
    });

    assert.deepEqual(handle.get(), ["CTRL+K"]);
    const section = preferences.read(PREFERENCE_SECTIONS.shortcuts, {});
    assert.deepEqual(section["extension.example.script.hello"], ["CTRL+K"]);
    assert.equal("mod.example.script.hello" in section, false);
    assert.deepEqual(section.keep, ["CTRL+L"]);
  } finally {
    preferences.write(PREFERENCE_SECTIONS.shortcuts, previous);
  }
});
