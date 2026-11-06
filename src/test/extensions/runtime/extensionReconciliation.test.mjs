/** Verifies packaged-Extension content identity, polling stability, and removal marks. */
import assert from "node:assert/strict";
import test from "node:test";
import { PREFERENCE_SECTIONS, PreferenceStore } from "../../../core/state/preferences.ts";
import {
  ANY_PACKAGE_CONTENT,
  ExtensionContentIndex,
  clearExtensionRemoved,
  clearStaleExtensionRemoved,
  isExtensionRemoved,
  markExtensionRemoved,
  packageContentIdentity,
  readExtensionRemovals,
} from "../../../frontend/platform/extensionReconciliation.ts";

const manifest = {
  kind: "extension",
  id: "test.i18n.package",
  name: "I18n package",
  version: "1.0.0",
  engines: { "rpe-redux": 1 },
  entry: "index.js",
  i18n: "i18n.json",
};

const translations = {
  en: { name: "I18n package", description: "Translated package" },
  zh: { name: "翻译包", description: "带翻译的扩展包" },
};

test("a package with i18n keeps one identity across ten polling passes", () => {
  const index = new ExtensionContentIndex();
  index.remember(manifest.id, packageContentIdentity(manifest, translations));
  for (let poll = 0; poll < 10; poll += 1) {
    // Discovery re-reads fresh objects; the runtime materialises translations
    // into its own snapshot. Neither changes the raw package bytes.
    const discoveredManifest = JSON.parse(JSON.stringify(manifest));
    const discoveredI18n = JSON.parse(JSON.stringify(translations));
    const materialized = { ...discoveredManifest, translations: discoveredI18n };
    assert.notEqual(
      JSON.stringify(materialized),
      JSON.stringify(discoveredManifest),
      "the test needs a materially different snapshot to reproduce the old false positive",
    );
    const identity = packageContentIdentity(discoveredManifest, discoveredI18n);
    assert.equal(index.matches(manifest.id, identity), true, `poll ${poll} looked changed`);
    assert.equal(index.needsReload(manifest.id, identity), false, `poll ${poll} would reload`);
  }
});

test("identity ignores object key order but follows manifest and i18n content", () => {
  const reordered = {
    i18n: "i18n.json",
    entry: "index.js",
    engines: { "rpe-redux": 1 },
    version: "1.0.0",
    name: "I18n package",
    id: "test.i18n.package",
    kind: "extension",
  };
  assert.equal(
    packageContentIdentity(manifest, translations),
    packageContentIdentity(reordered, translations),
  );
  assert.notEqual(
    packageContentIdentity(manifest, translations),
    packageContentIdentity({ ...manifest, version: "1.0.1" }, translations),
  );
  assert.notEqual(
    packageContentIdentity(manifest, translations),
    packageContentIdentity(manifest, {
      ...translations,
      en: { ...translations.en, description: "Changed" },
    }),
  );

  const index = new ExtensionContentIndex();
  assert.equal(index.matches(manifest.id, "anything"), null);
  assert.equal(index.needsReload(manifest.id, "anything"), true);
  index.remember(manifest.id, "first");
  assert.equal(index.needsReload(manifest.id, "first"), false);
  assert.equal(index.needsReload(manifest.id, "first", true), true);
  index.forget(manifest.id);
  assert.equal(index.matches(manifest.id, "first"), null);
});

test("discovery skips unchanged i18n packages for ten refresh passes", () => {
  const index = new ExtensionContentIndex();
  const identity = packageContentIdentity(manifest, translations);
  index.remember(manifest.id, identity);
  for (let poll = 0; poll < 10; poll += 1) {
    assert.equal(
      index.reconcile(manifest.id, identity, {
        existing: true,
        userManaged: true,
        skipExisting: true,
      }),
      "skip",
      `poll ${poll} scheduled a reload`,
    );
  }
  assert.equal(
    index.reconcile(manifest.id, identity, {
      existing: true,
      userManaged: true,
      skipExisting: true,
      force: true,
    }),
    "reload",
  );
  assert.equal(
    index.reconcile(
      manifest.id,
      packageContentIdentity({ ...manifest, version: "2.0.0" }, translations),
      {
        existing: true,
        userManaged: true,
        skipExisting: true,
      },
    ),
    "reload",
  );
});

test("discovery respects a removal mark and registers changed bytes again", () => {
  const index = new ExtensionContentIndex();
  const identity = packageContentIdentity(manifest, translations);
  assert.equal(
    index.reconcile(manifest.id, identity, {
      existing: false,
      userManaged: false,
      skipExisting: true,
      removed: true,
    }),
    "skip",
  );
  assert.equal(
    index.reconcile(manifest.id, identity, {
      existing: false,
      userManaged: false,
      skipExisting: true,
      removed: false,
    }),
    "register",
  );
});

test("entry-only edits stay on the explicit reload path", () => {
  const index = new ExtensionContentIndex();
  const identity = packageContentIdentity(manifest, translations);
  index.remember(manifest.id, identity);
  // The polling identity deliberately covers manifest and i18n bytes only.
  // Editing index.js in place does not change it; the settings row's Reload
  // action calls reloadPackagedExtension(id), which forces a re-read.
  assert.equal(index.needsReload(manifest.id, identity), false);
  assert.equal(index.needsReload(manifest.id, identity, true), true);
});

test("a removed package stays hidden for the same bytes and returns after a change", () => {
  const store = new PreferenceStore();
  const identity = packageContentIdentity(manifest, translations);
  assert.equal(isExtensionRemoved(store, manifest.id, identity), false);

  markExtensionRemoved(store, manifest.id, identity, 123);
  assert.deepEqual(readExtensionRemovals(store), [{ id: manifest.id, identity, removedAt: 123 }]);
  assert.equal(isExtensionRemoved(store, manifest.id, identity), true);
  assert.equal(isExtensionRemoved(store, manifest.id, "different bytes"), false);

  clearStaleExtensionRemoved(store, manifest.id, "different bytes");
  assert.equal(readExtensionRemovals(store).length, 0, "changed bytes did not clear the mark");
  assert.equal(isExtensionRemoved(store, manifest.id, "different bytes"), false);

  markExtensionRemoved(store, manifest.id, ANY_PACKAGE_CONTENT);
  assert.equal(isExtensionRemoved(store, manifest.id, "anything"), true);
  clearExtensionRemoved(store, manifest.id);
  assert.equal(isExtensionRemoved(store, manifest.id, "anything"), false);
  assert.equal(readExtensionRemovals(store).length, 0);
});

test("removal marks preserve unrelated preference sections", () => {
  const store = new PreferenceStore();
  store.write(PREFERENCE_SECTIONS.settings, { "extension:order": ["a"] });
  markExtensionRemoved(store, "a", "hash");
  assert.deepEqual(store.read(PREFERENCE_SECTIONS.settings, {}), {
    "extension:order": ["a"],
    "extension:removed": [
      { id: "a", identity: "hash", removedAt: readExtensionRemovals(store)[0].removedAt },
    ],
  });
});
