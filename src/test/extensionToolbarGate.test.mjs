/**
 * Verifies the toolbar gate rejects malformed package entries before they reach
 * the shared registry, while accepting the structural field and control shapes
 * a package may contribute.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { toolbar as toolbarApi } from "../core/api/toolbar.ts";
import { values as valuesApi } from "../core/api/values.ts";
import { gateExtensionApi } from "../core/extensions/capabilityGate.ts";

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
    toolbar: toolbarApi,
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

/** Unique suffix so the process-wide registry never collides across tests. */
function suffix() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

test("a malformed toolbar entry is rejected without touching the registry", () => {
  const owner = `toolbar-invalid.${suffix()}`;
  const gated = gateExtensionApi(fakeApi(), new Set(["ui.toolbar"]), owner);
  const before = toolbarApi.get().length;
  const rejected = (id) => (error) => {
    assert.equal(error?.code, "invalid_request");
    assert.match(error.message, /toolbar/iu);
    assert.equal(toolbarApi.entry(`extension.${owner}.${id}`), undefined);
    return true;
  };

  assert.throws(
    () =>
      gated.toolbar.register({
        kind: "field",
        field: "number",
        id: "missing-value",
        domId: "extension-missing-value",
        row: 1,
        order: 1,
        label: "Missing value",
        input: () => undefined,
      }),
    rejected("missing-value"),
  );
  assert.throws(
    () =>
      gated.toolbar.register({
        kind: "field",
        field: "number",
        id: "blank-value",
        domId: "extension-blank-value",
        row: 1,
        order: 1,
        value: " ",
        label: "Blank value",
        input: () => undefined,
      }),
    rejected("blank-value"),
  );
  assert.throws(
    () =>
      gated.toolbar.register({
        kind: "control",
        id: "unknown-control",
        row: 1,
        order: 1,
        controlId: "package-owned-renderer",
      }),
    rejected("unknown-control"),
  );
  assert.throws(
    () =>
      gated.toolbar.register({
        kind: "bogus",
        id: "unknown-kind",
        row: 1,
        order: 1,
      }),
    rejected("unknown-kind"),
  );
  assert.throws(
    () =>
      gated.toolbar.register({
        kind: "action",
        id: "invalid-cells",
        row: 1,
        order: 1,
        group: "test",
        label: "Invalid cells",
        tooltip: "Invalid cells",
        icon: "help",
        cells: 0,
        run: () => undefined,
      }),
    rejected("invalid-cells"),
  );
  assert.equal(toolbarApi.get().length, before, "a rejected entry reached the registry");
});

test("a structurally valid toolbar field and control register", () => {
  const owner = `toolbar-valid.${suffix()}`;
  const gated = gateExtensionApi(fakeApi(), new Set(["ui.toolbar"]), owner);
  let disposeField = null;
  let disposeControl = null;
  let disposeAction = null;
  try {
    disposeField = gated.toolbar.register({
      kind: "field",
      field: "number",
      id: "field",
      domId: "extension-field",
      row: 1,
      order: 1,
      value: `extension.${owner}.fieldValue`,
      label: "Field",
      input: () => undefined,
    });
    disposeControl = gated.toolbar.register({
      kind: "control",
      id: "control",
      row: 1,
      order: 2,
      controlId: "playback",
    });
    disposeAction = gated.toolbar.register({
      kind: "action",
      id: "action",
      row: 1,
      order: 3,
      group: "test",
      label: "Action",
      tooltip: "Action",
      icon: "help",
      cells: "auto",
      run: () => undefined,
    });

    assert.equal(toolbarApi.entry(`extension.${owner}.field`)?.kind, "field");
    assert.equal(toolbarApi.entry(`extension.${owner}.control`)?.kind, "control");
    assert.equal(toolbarApi.entry(`extension.${owner}.action`)?.cells, "auto");
  } finally {
    disposeAction?.();
    disposeControl?.();
    disposeField?.();
  }
  assert.equal(toolbarApi.entry(`extension.${owner}.field`), undefined);
  assert.equal(toolbarApi.entry(`extension.${owner}.control`), undefined);
});
