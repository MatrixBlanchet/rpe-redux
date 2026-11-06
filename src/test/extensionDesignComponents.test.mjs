/** Verifies the versioned Extension design-component catalog and lifecycle seam. */
import assert from "node:assert/strict";
import test from "node:test";
import {
  EXTENSION_DESIGN_SDK_VERSION,
  extensionDesignCatalog,
  ExtensionDesignValidationError,
  normalizeExtensionDesignPanel,
} from "../core/extensions/designComponents.ts";
import { connectExtensionUiHost } from "../core/extensions/extensionUi.ts";
import { ExtensionRuntime } from "../core/extensions/extensionRuntime.ts";
import { PreferenceStore } from "../core/state/preferences.ts";

/** Build a minimal manifest for one design-component package. */
function manifest(id) {
  return {
    kind: "extension",
    id,
    name: id,
    version: "1.0.0",
    engines: { "rpe-redux": 1 },
    entry: "index.js",
    capabilities: ["ui.panel"],
  };
}

test("the design catalog publishes slots, versions, and bounded component props", () => {
  const catalog = extensionDesignCatalog();
  assert.equal(catalog.sdkVersion, EXTENSION_DESIGN_SDK_VERSION);
  assert.deepEqual(
    catalog.slots.map((slot) => slot.id),
    ["inspector.panel", "editor.drawer"],
  );
  assert.deepEqual(
    catalog.components.map((component) => component.id),
    ["text", "button", "stack"],
  );
  assert.equal(
    catalog.components.every((component) => component.version === 1),
    true,
  );
  assert.equal(
    catalog.components.find((component) => component.id === "button").props.includes("onClick"),
    false,
  );
});

test("design panel validation accepts safe trees and rejects unknown slots, versions, and props", () => {
  const normalized = normalizeExtensionDesignPanel({
    id: "summary",
    slot: "inspector.panel",
    component: {
      type: "stack",
      version: 1,
      props: { direction: "column", gap: "sm" },
      children: [
        { type: "text", version: 1, props: { id: "heading", text: "Summary", size: "heading" } },
        {
          type: "button",
          version: 1,
          props: { id: "refresh", label: "Refresh", variant: "solid" },
        },
      ],
    },
  });
  assert.equal(normalized.component.children.length, 2);
  assert.equal(Object.isFrozen(normalized), true);
  assert.throws(
    () => normalizeExtensionDesignPanel({ ...normalized, slot: "unknown" }),
    (error) => error instanceof ExtensionDesignValidationError && error.code === "unknownSlot",
  );
  assert.throws(
    () =>
      normalizeExtensionDesignPanel({
        ...normalized,
        component: { type: "button", version: 2, props: { label: "Nope" } },
      }),
    (error) =>
      error instanceof ExtensionDesignValidationError && error.code === "unsupportedVersion",
  );
  assert.throws(
    () =>
      normalizeExtensionDesignPanel({
        ...normalized,
        component: { type: "button", version: 1, props: { label: "Nope", onClick: "escape" } },
      }),
    (error) => error instanceof ExtensionDesignValidationError && error.code === "invalidProps",
  );
});

test("design registrations use the host seam and dispose with the Extension scope", async () => {
  const registrations = [];
  const disposers = [];
  const disconnect = connectExtensionUiHost({
    capabilities: ["panel", "sidebar", "overlay"],
    registerPanel: () => () => {},
    designCatalog: extensionDesignCatalog,
    registerDesignPanel(request, definition) {
      registrations.push(definition);
      const dispose = () => {
        const index = disposers.indexOf(dispose);
        if (index >= 0) {
          disposers.splice(index, 1);
        }
      };
      disposers.push(dispose);
      request.signal.addEventListener("abort", dispose, { once: true });
      return dispose;
    },
    registerSidebar: () => () => {},
    registerOverlay: () => () => {},
  });
  const id = `test.design.components.${Date.now()}`;
  const runtime = new ExtensionRuntime({
    preferenceStore: new PreferenceStore(),
    hostVersion: "1.0.0",
  });
  let context;
  runtime.setSandboxFactory((input) => {
    context = input.context;
    return { start: async () => {}, dispose: () => {} };
  });
  try {
    assert.equal(
      runtime.loadManifest(manifest(id), async () => ({
        source: "export default { activate() {} };",
      })).ok,
      true,
    );
    assert.equal((await runtime.enableAsync(id, true)).ok, true);
    assert.equal((await context.ui.designCatalog()).sdkVersion, EXTENSION_DESIGN_SDK_VERSION);
    const dispose = context.ui.registerDesignPanel({
      id: "summary",
      slot: "inspector.panel",
      component: { type: "text", version: 1, props: { text: "Ready" } },
    });
    assert.equal(registrations.length, 1);
    assert.equal(registrations[0].slot, "inspector.panel");
    dispose();
    assert.equal(disposers.length, 0);
    context.ui.registerDesignPanel({
      id: "scoped",
      slot: "editor.drawer",
      component: { type: "button", version: 1, props: { label: "Scoped" } },
    });
    assert.equal(disposers.length, 1);
    assert.equal(runtime.disable(id).ok, true);
    assert.equal(disposers.length, 0);
  } finally {
    if (runtime.list().some((entry) => entry.manifest.id === id)) {
      runtime.uninstall(id);
    }
    disconnect();
  }
});
