/** Settings registration accepts the action kinds the settings UI can render. */
import assert from "node:assert/strict";
import test from "node:test";
import { SettingsRegistry, declarePersistedValue } from "../core/settings/settings.ts";
import { PREFERENCE_SECTIONS, readPreference, writePreference } from "../core/state/preferences.ts";
import { values } from "../core/state/values.ts";

function action(url) {
  return {
    key: `test.survey.${url.replace(/\W/gu, "")}`,
    navigation: "help",
    group: "",
    label: "settings.field.survey.label",
    control: "action",
    action: { kind: "open-url", url },
  };
}

/** Unique suffix so process-wide registries and preferences never collide. */
function suffix() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/** One toggle definition addressed by a caller-chosen key and navigation. */
function toggle(key, navigation) {
  return {
    key,
    navigation,
    group: "",
    label: "test.setting.label",
    control: "toggle",
    default: false,
  };
}

/** The current settings preference section. */
function settingsSection() {
  return readPreference(PREFERENCE_SECTIONS.settings, {});
}

test("an open-url action accepts an HTTPS target", () => {
  const registry = new SettingsRegistry();
  assert.doesNotThrow(() => registry.registerSetting(action("https://example.com/survey")));
});

test("an open-url action rejects a non-HTTPS target", () => {
  const registry = new SettingsRegistry();
  assert.throws(() => registry.registerSetting(action("http://example.com/survey")), /HTTPS/u);
});

test("an owner setting and navigation live under the owner namespace", () => {
  const registry = new SettingsRegistry();
  const owner = `test.namespace.${suffix()}`;
  const key = `extension.${owner}.enabled`;
  const navigation = `extension.${owner}.plugin`;
  registry.registerNavigation({ key: "plugin", label: "test.setting.label", order: 900 }, owner);
  registry.registerNavigation(
    { key: "advanced", parent: "plugin", label: "test.setting.label" },
    owner,
  );
  registry.registerSetting(toggle("enabled", "plugin"), owner);
  try {
    assert.equal(registry.definition("enabled"), undefined);
    assert.equal(registry.definition(key)?.key, key);
    assert.equal(registry.definition(key)?.navigation, navigation);
    assert.equal(values.byId.has(key), true);
    assert.equal(values.ownerOf(key), owner);
    assert.equal(
      registry.navigations().some((entry) => entry.key === navigation),
      true,
    );
    assert.equal(
      registry.navigations().find((entry) => entry.key === `extension.${owner}.advanced`)?.parent,
      navigation,
    );
    assert.equal(registry.navigationChildren(navigation).length, 1);
  } finally {
    values.removeOwner(owner);
  }
});

test("an already qualified owner key is not prefixed twice", () => {
  const registry = new SettingsRegistry();
  const owner = `test.qualified.${suffix()}`;
  const key = `extension.${owner}.direct`;
  registry.registerSetting(toggle(key, `extension.${owner}.help`), owner);
  try {
    assert.equal(registry.definition(key)?.key, key);
    assert.equal(registry.definition(`extension.${owner}.${key}`), undefined);
    assert.equal(values.byId.has(key), true);
    assert.throws(
      () => registry.registerSetting(toggle(`extension.other.${suffix()}`, "help"), owner),
      /must be local/u,
    );
  } finally {
    values.removeOwner(owner);
  }
});

test("an owner setting cannot claim a future host key", () => {
  const registry = new SettingsRegistry();
  const owner = `test.host-key.${suffix()}`;
  const local = `future.host.${suffix()}`;
  const key = `extension.${owner}.${local}`;
  registry.registerSetting(toggle(local, "help"), owner);
  try {
    assert.equal(registry.definition(key)?.key, key);
    assert.equal(values.byId.has(key), true);
    assert.equal(values.byId.has(local), false);
  } finally {
    values.removeOwner(owner);
  }
});

test("an owner setting migrates its legacy bare key once", () => {
  const registry = new SettingsRegistry();
  const owner = `test.migrate.${suffix()}`;
  const legacyKey = `legacy.flag.${suffix()}`;
  const key = `extension.${owner}.${legacyKey}`;
  const previous = settingsSection();
  try {
    writePreference(PREFERENCE_SECTIONS.settings, { ...previous, [legacyKey]: true });
    const dispose = registry.registerSetting(toggle(legacyKey, "help"), owner);
    assert.equal(values.byId.get(key), true);
    let section = settingsSection();
    assert.equal(section[key], true);
    assert.equal(Object.hasOwn(section, legacyKey), false);

    dispose();
    values.removeOwner(owner);
    registry.registerSetting(toggle(legacyKey, "help"), owner);
    assert.equal(values.byId.get(key), true);
    section = settingsSection();
    assert.equal(section[key], true);
    assert.equal(Object.hasOwn(section, legacyKey), false);
  } finally {
    values.removeOwner(owner);
    writePreference(PREFERENCE_SECTIONS.settings, previous);
  }
});

test("an owner migration never consumes another declared value", () => {
  const registry = new SettingsRegistry();
  const owner = `test.guard.${suffix()}`;
  const hostKey = `host.owned.${suffix()}`;
  const previous = settingsSection();
  try {
    writePreference(PREFERENCE_SECTIONS.settings, { ...previous, [hostKey]: true });
    declarePersistedValue(hostKey, false);
    assert.equal(values.byId.get(hostKey), true);
    registry.registerSetting(toggle(hostKey, "help"), owner);
    assert.equal(values.byId.get(hostKey), true);
    assert.equal(values.byId.get(`extension.${owner}.${hostKey}`), false);
    assert.equal(settingsSection()[hostKey], true);
  } finally {
    values.removeOwner(owner);
    values.undefine(hostKey, { purge: true });
    writePreference(PREFERENCE_SECTIONS.settings, previous);
  }
});

test("host settings keep their bare key and navigation", () => {
  const registry = new SettingsRegistry();
  const key = `test.host.${suffix()}`;
  const navigation = `test.host-nav.${suffix()}`;
  registry.registerNavigation({ key: navigation, label: "test.setting.label" });
  registry.registerSetting(toggle(key, navigation));
  try {
    assert.equal(registry.definition(key)?.key, key);
    assert.equal(registry.definition(key)?.navigation, navigation);
    assert.equal(values.byId.has(key), true);
    assert.equal(values.ownerOf(key), undefined);
    assert.equal(
      registry.navigations().some((entry) => entry.key === navigation),
      true,
    );
  } finally {
    values.undefine(key, { purge: true });
  }
});

test("a duplicate owner setting key is still rejected", () => {
  const registry = new SettingsRegistry();
  const owner = `test.duplicate.${suffix()}`;
  registry.registerSetting(toggle("flag", "help"), owner);
  try {
    assert.throws(
      () => registry.registerSetting(toggle("flag", "help"), owner),
      /Contribution already registered/u,
    );
  } finally {
    values.removeOwner(owner);
  }
});

test("unregisterOwner keeps stored settings and purgeOwner removes them", () => {
  const registry = new SettingsRegistry();
  const owner = `test.purge.${suffix()}`;
  const key = `extension.${owner}.flag`;
  const previous = settingsSection();
  registry.registerNavigation({ key: "plugin", label: "test.setting.label" }, owner);
  registry.registerSetting(toggle("flag", "plugin"), owner);
  try {
    values.byId.set(key, true);
    registry.unregisterOwner(owner);
    assert.equal(registry.navigations().length, 0);
    assert.equal(registry.definitions().length, 0);
    assert.equal(values.byId.has(key), true);
    assert.equal(settingsSection()[key], true);

    registry.purgeOwner(owner);
    assert.equal(Object.hasOwn(settingsSection(), key), false);
    assert.equal(values.byId.has(key), true);
  } finally {
    values.purgeOwner(owner);
    writePreference(PREFERENCE_SECTIONS.settings, previous);
  }
});

test("an owner setting stays on an already registered host navigation", () => {
  const registry = new SettingsRegistry();
  const owner = `test.host-page.${suffix()}`;
  const key = `extension.${owner}.flag`;
  registry.registerNavigation({ key: "help", label: "test.setting.label" });
  registry.registerSetting(toggle("flag", "help"), owner);
  try {
    assert.equal(registry.definition(key)?.navigation, "help");
    assert.equal(
      registry.navigations().some((entry) => entry.key === "help"),
      true,
    );
    assert.equal(
      registry.navigations().some((entry) => entry.key === `extension.${owner}.help`),
      false,
    );
  } finally {
    values.removeOwner(owner);
  }
});

test("an owner setting uses its qualified navigation once the page is registered", () => {
  const registry = new SettingsRegistry();
  const owner = `test.own-page.${suffix()}`;
  const key = `extension.${owner}.flag`;
  const navigation = `extension.${owner}.section`;
  registry.registerNavigation({ key: "section", label: "test.setting.label" }, owner);
  registry.registerSetting(toggle("flag", "section"), owner);
  try {
    assert.equal(registry.definition(key)?.navigation, navigation);
    assert.equal(
      registry.navigations().some((entry) => entry.key === navigation),
      true,
    );
  } finally {
    values.removeOwner(owner);
  }
});

test("an owner setting defaults to a qualified navigation before its page exists", () => {
  const registry = new SettingsRegistry();
  const owner = `test.later-page.${suffix()}`;
  const key = `extension.${owner}.flag`;
  const navigation = `extension.${owner}.section`;
  registry.registerSetting(toggle("flag", "section"), owner);
  try {
    assert.equal(registry.definition(key)?.navigation, navigation);
    registry.registerNavigation({ key: "section", label: "test.setting.label" }, owner);
    assert.equal(
      registry.navigations().some((entry) => entry.key === navigation),
      true,
    );
  } finally {
    values.removeOwner(owner);
  }
});
