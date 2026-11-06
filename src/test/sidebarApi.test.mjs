/** Verifies the gated sidebar handle namespaces ids and enforces divider ownership. */
import assert from "node:assert/strict";
import test from "node:test";
import { sidebar as sidebarApi } from "../core/api/sidebar.ts";
import { values as valuesApi } from "../core/api/values.ts";
import { gateExtensionApi } from "../core/extensions/capabilityGate.ts";
import { getSidebarEntry } from "../core/shell/registries/sidebar.ts";

/** A facade-shaped object with only the handles the gate reads at build time. */
function fakeApi() {
  return {
    version: "test",
    chart: { placeNote() {} },
    transaction: {},
    selection: {},
    document: {},
    library: {},
    playback: {},
    settings: {},
    toolbar: {},
    sidebar: sidebarApi,
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

/** One sidebar item with a stable label for ownership assertions. */
function item(id, label, order = 10) {
  return {
    id,
    order,
    icon: { name: "help", label },
    onActivate() {},
  };
}

test("the same local sidebar id is namespaced separately for each owner", () => {
  const first = gateExtensionApi(fakeApi(), new Set(["ui.sidebar"]), "owner-a");
  const second = gateExtensionApi(fakeApi(), new Set(["ui.sidebar"]), "owner-b");
  const disposeFirst = first.sidebar.register(item("shared", "First"));
  const disposeSecond = second.sidebar.register(item("shared", "Second"));
  try {
    assert.deepEqual(
      first.sidebar.get().map((entry) => entry.id),
      ["extension.owner-a.shared"],
    );
    assert.deepEqual(
      second.sidebar.get().map((entry) => entry.id),
      ["extension.owner-b.shared"],
    );
    assert.equal(first.sidebar.entry("shared")?.icon.label, "First");
    assert.equal(second.sidebar.entry("shared")?.icon.label, "Second");
    assert.equal(first.sidebar.entry("extension.owner-b.shared"), undefined);
    assert.equal(second.sidebar.entry("extension.owner-a.shared"), undefined);
  } finally {
    disposeFirst();
    disposeSecond();
  }
  assert.equal(getSidebarEntry("extension.owner-a.shared"), undefined);
  assert.equal(getSidebarEntry("extension.owner-b.shared"), undefined);
});

test("registerAll scopes every item before it reaches the registry", () => {
  const first = gateExtensionApi(fakeApi(), new Set(["ui.sidebar"]), "owner-a");
  const second = gateExtensionApi(fakeApi(), new Set(["ui.sidebar"]), "owner-b");
  const dispose = first.sidebar.registerAll([item("one", "One", 10), item("two", "Two", 20)]);
  try {
    assert.deepEqual(
      first.sidebar.get().map((entry) => entry.id),
      ["extension.owner-a.one", "extension.owner-a.two"],
    );
    assert.equal(first.sidebar.entry("one")?.icon.label, "One");
    assert.equal(second.sidebar.entry("extension.owner-a.one"), undefined);
  } finally {
    dispose();
  }
  assert.equal(getSidebarEntry("extension.owner-a.one"), undefined);
  assert.equal(getSidebarEntry("extension.owner-a.two"), undefined);
});

test("a package cannot claim another package's qualified sidebar id", () => {
  const first = gateExtensionApi(fakeApi(), new Set(["ui.sidebar"]), "owner-a");
  const second = gateExtensionApi(fakeApi(), new Set(["ui.sidebar"]), "owner-b");
  const dispose = first.sidebar.register(item("shared", "First"));
  try {
    assert.throws(
      () => second.sidebar.register(item("extension.owner-a.shared", "Second")),
      /must be local/u,
    );
    assert.equal(first.sidebar.entry("extension.owner-a.shared")?.icon.label, "First");
    assert.deepEqual(
      first.sidebar.get().map((entry) => entry.id),
      ["extension.owner-a.shared"],
    );
    assert.equal(second.sidebar.entry("extension.owner-a.shared"), undefined);
    assert.throws(() => second.sidebar.unregister("extension.owner-a.shared"), /ui\.sidebar/u);
    assert.equal(getSidebarEntry("extension.owner-a.shared")?.icon.label, "First");
  } finally {
    dispose();
  }
  assert.equal(getSidebarEntry("extension.owner-a.shared"), undefined);
});

test("dividers stay inside their owner and cleanup leaves other owners intact", () => {
  const first = gateExtensionApi(fakeApi(), new Set(["ui.sidebar"]), "owner-a");
  const second = gateExtensionApi(fakeApi(), new Set(["ui.sidebar"]), "owner-b");
  const disposeFirst = first.sidebar.registerDivider({
    kind: "divider",
    id: "separator",
    order: 10,
  });
  const disposeSecond = second.sidebar.registerDivider({
    kind: "divider",
    id: "separator",
    order: 20,
  });
  try {
    assert.equal(first.sidebar.entry("separator")?.id, "extension.owner-a.separator");
    assert.equal(second.sidebar.entry("separator")?.id, "extension.owner-b.separator");
    assert.equal(first.sidebar.entry("extension.owner-b.separator"), undefined);
    assert.throws(
      () =>
        second.sidebar.registerDivider({
          kind: "divider",
          id: "extension.owner-a.separator",
          order: 30,
        }),
      /must be local/u,
    );
    assert.throws(() => second.sidebar.unregister("extension.owner-a.separator"), /ui\.sidebar/u);
    assert.equal(
      first.sidebar.entry("extension.owner-a.separator")?.id,
      "extension.owner-a.separator",
    );

    disposeFirst();
    assert.equal(getSidebarEntry("extension.owner-a.separator"), undefined);
    assert.equal(getSidebarEntry("extension.owner-b.separator")?.id, "extension.owner-b.separator");
    assert.equal(second.sidebar.entry("separator")?.id, "extension.owner-b.separator");
  } finally {
    disposeFirst();
    disposeSecond();
  }
  assert.equal(getSidebarEntry("extension.owner-b.separator"), undefined);
});
