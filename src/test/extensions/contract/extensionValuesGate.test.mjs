/** Verifies the gated values handle keeps owner checks for bridged writes. */
import assert from "node:assert/strict";
import test from "node:test";
import { values as valuesApi } from "../../../core/api/values.ts";
import { gateExtensionApi } from "../../../core/extensions/capabilityGate.ts";
import { settingsRegistry } from "../../../core/settings/settings.ts";
import {
  PREFERENCE_SECTIONS,
  readPreference,
  writePreference,
} from "../../../core/state/preferences.ts";
import { values as valueRegistry } from "../../../core/state/values.ts";
import {
  createSandboxValueHandleTable,
  encodeBridgeResult,
} from "../../../frontend/platform/sandboxBridge.ts";

/** A facade-shaped object with only the handles the gate reads at build time. */
function fakeApi() {
  return {
    version: "test",
    chart: {},
    transaction: {},
    selection: {},
    document: {},
    library: {},
    playback: {},
    settings: {},
    toolbar: {},
    sidebar: {},
    contextMenu: {},
    values: valuesApi,
    shortcuts: {},
    diagnostics: {},
    hitTest: {},
    preview: {},
    layout: {},
    workspace: {},
    help: {},
    extensions: {},
  };
}

test("a defined value and a host value both keep the owner write check", () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const gated = gateExtensionApi(fakeApi(), new Set(["values"]), "owner-a");
  const own = gated.values.define({ id: `own.${suffix}`, initial: 0 });
  assert.equal(own.id, `extension.owner-a.own.${suffix}`);
  own.set(1);
  assert.equal(own.get(), 1);

  const hostId = `test.host.${suffix}`;
  valuesApi.define({ id: hostId, initial: "host" });
  const host = gated.values.getHandle(hostId);
  assert.throws(
    () => host.set("changed"),
    (error) => error?.code === "capabilityDenied",
    "a host value accepted a bridged write",
  );
  assert.throws(
    () => gated.values.byId.set(hostId, "changed"),
    (error) => error?.code === "capabilityDenied",
    "byId accepted a host write",
  );
  assert.equal(valuesApi.byId.get(hostId), "host");
});

test("a bridged handle keeps its writes and subscriptions inside the owner table", () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const gated = gateExtensionApi(fakeApi(), new Set(["values"]), "owner-b");
  let nextId = 1;
  const table = createSandboxValueHandleTable(() => nextId++);
  const own = gated.values.define({ id: `bridged.${suffix}`, initial: "initial" });
  const marker = encodeBridgeResult(own, {
    valueHandle: (value) => (value === own ? table.encode(own) : undefined),
  });
  assert.equal(marker.id, own.id);

  const bridged = table.require(marker.__valueHandle);
  assert.equal(bridged.id, own.id);
  assert.equal(bridged.get(), "initial");
  bridged.set("set-value");
  assert.equal(own.get(), "set-value");
  let updates = 0;
  const stop = bridged.subscribe(() => {
    updates += 1;
  });
  bridged.update("updated-value");
  assert.equal(updates, 1);
  stop();
  bridged.set("after-stop");
  assert.equal(updates, 1);

  const hostId = `test.host.bridged.${suffix}`;
  valuesApi.define({ id: hostId, initial: "host" });
  const host = gated.values.getHandle(hostId);
  assert.throws(
    () => host.set("changed"),
    (error) => error?.code === "capabilityDenied",
    "a bridged host handle accepted a write",
  );
  assert.equal(valuesApi.byId.get(hostId), "host");

  table.clear();
  assert.throws(() => table.require(marker.__valueHandle), /not available/u);
});

test("values.define cannot migrate or delete a host preference key", () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const owner = `owner-legacy-${suffix}`;
  const hostKey = `host.setting.${suffix}`;
  const before = readPreference(PREFERENCE_SECTIONS.settings, {});
  writePreference(PREFERENCE_SECTIONS.settings, { ...before, [hostKey]: true });
  const gated = gateExtensionApi(fakeApi(), new Set(["values"]), owner);
  try {
    const handle = gated.values.define({
      id: `leak.${suffix}`,
      initial: false,
      persist: "settings",
      legacyStorageKey: hostKey,
    });
    assert.equal(handle.get(), false, "the package adopted the host value");
    assert.equal(
      readPreference(PREFERENCE_SECTIONS.settings, {})[hostKey],
      true,
      "the package migrated or deleted the host key",
    );
    assert.equal(readPreference(PREFERENCE_SECTIONS.values, {})[handle.id], undefined);
  } finally {
    valueRegistry.purgeOwner(owner);
    const current = readPreference(PREFERENCE_SECTIONS.settings, {});
    if (Object.hasOwn(current, hostKey)) {
      const next = { ...current };
      delete next[hostKey];
      writePreference(PREFERENCE_SECTIONS.settings, next);
    }
  }
});

test("values.define ignores persist and storage key requests", () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const owner = `owner-persist-${suffix}`;
  const gated = gateExtensionApi(fakeApi(), new Set(["values"]), owner);
  const id = `kept.${suffix}`;
  try {
    const handle = gated.values.define({
      id,
      initial: 0,
      persist: "settings",
      storageKey: `custom.${suffix}`,
    });
    handle.set(5);
    const values = readPreference(PREFERENCE_SECTIONS.values, {});
    assert.equal(values[handle.id], 5, "the value did not land in the values section");
    assert.equal(values[`custom.${suffix}`], undefined, "the package storage key was used");
    assert.equal(
      readPreference(PREFERENCE_SECTIONS.settings, {})[handle.id],
      undefined,
      "the package selected the settings section",
    );
  } finally {
    valueRegistry.purgeOwner(owner);
  }
});

test("a package reaches its own setting through the local id alias", () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const owner = `owner-alias-${suffix}`;
  const hostId = `host.value.${suffix}`;
  const gated = gateExtensionApi(fakeApi(), new Set(["settings", "values"]), owner);
  const dispose = gated.settings.registerSetting({
    key: "flag",
    navigation: "page",
    group: "tests",
    label: "Flag",
    control: "toggle",
    default: false,
  });
  valuesApi.define({ id: hostId, initial: "host" });
  try {
    assert.equal(gated.values.byId.has("flag"), true);
    assert.equal(gated.values.byId.ownerOf("flag"), owner);
    assert.equal(gated.values.byId.get("flag"), false);
    gated.values.byId.set("flag", true);
    assert.equal(valuesApi.byId.get(`extension.${owner}.flag`), true);
    assert.equal(readPreference(PREFERENCE_SECTIONS.settings, {})[`extension.${owner}.flag`], true);

    // By-id reads stay compatible with published host values; writes do not.
    assert.equal(gated.values.byId.get(hostId), "host");
    assert.throws(
      () => gated.values.byId.set(hostId, "changed"),
      (error) => error?.code === "capabilityDenied",
      "the local alias let a package write a host value",
    );
    assert.equal(valuesApi.byId.get(hostId), "host");
  } finally {
    dispose();
    settingsRegistry.purgeOwner(owner);
    valueRegistry.purgeOwner(owner);
    valueRegistry.undefine(hostId);
  }
});
