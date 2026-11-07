/** Verifies the public Extension hook seam and its activation lifetime. */
import assert from "node:assert/strict";
import test from "node:test";
import { connectExtensionApi } from "../../../core/extensions/extensionApi.ts";
import { ExtensionRuntime } from "../../../core/extensions/extensionRuntime.ts";
import {
  PublicHookError,
  PublicHookRegistry,
  publicHookRegistry,
} from "../../../core/extensions/publicHooks.ts";
import { PreferenceStore } from "../../../core/state/preferences.ts";

/** Minimal facade required by the Extension runtime's lazy API getter. */
connectExtensionApi({ version: "test" });

/** Build one valid code-package manifest. */
function manifest(id, capabilities = ["hooks"]) {
  return {
    kind: "extension",
    id,
    name: id,
    version: "1.0.0",
    engines: { "rpe-redux": 1 },
    entry: "index.js",
    capabilities,
  };
}

test("public hooks validate namespaces, order handlers, merge patches, and cancel", async () => {
  const registry = new PublicHookRegistry();
  const calls = [];
  registry.register(
    "example.provider:decorate",
    (payload) => {
      calls.push(`low:${payload.label}`);
      return { label: `${payload.label}!` };
    },
    {
      owner: "example.provider",
      priority: 1,
      schema: {
        fields: { label: { type: "string", required: true }, cancel: { type: "boolean" } },
      },
    },
  );
  registry.register(
    "example.provider:decorate",
    (payload) => {
      calls.push(`high:${payload.label}`);
      return { cancel: true, label: payload.label.toUpperCase() };
    },
    {
      owner: "example.provider",
      priority: 10,
      schema: {
        fields: { label: { type: "string", required: true }, cancel: { type: "boolean" } },
      },
    },
  );

  const result = await registry.invoke("example.provider:decorate", { label: "note" });
  assert.deepEqual(calls, ["high:note"]);
  assert.deepEqual(result.payload, { label: "NOTE", cancel: true });
  assert.equal(result.cancelled, true);
  assert.equal(result.handled, true);
  assert.throws(
    () =>
      registry.register("other.provider:decorate", () => undefined, {
        owner: "example.provider",
        schema: { fields: {} },
      }),
    (error) => error instanceof PublicHookError && error.code === "hookNameInvalid",
  );
});

test("public hooks expose cancellation, timeout, and invalid-result errors", async () => {
  const registry = new PublicHookRegistry();
  const controller = new AbortController();
  registry.register(
    "example.provider:abort",
    async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return { ok: true };
    },
    {
      owner: "example.provider",
      schema: { fields: { ok: { type: "boolean" } }, allowUnknown: true },
    },
  );
  controller.abort();
  await assert.rejects(
    registry.invoke("example.provider:abort", {}, { signal: controller.signal }),
    (error) => error instanceof PublicHookError && error.code === "hookCancelled",
  );

  registry.register(
    "example.provider:slow",
    async () => {
      await new Promise((resolve) => setTimeout(resolve, 25));
      return {};
    },
    { owner: "example.provider", schema: { fields: {}, allowUnknown: true } },
  );
  await assert.rejects(
    registry.invoke("example.provider:slow", {}, { timeoutMs: 1 }),
    (error) => error instanceof PublicHookError && error.code === "hookTimeout",
  );

  registry.register("example.provider:bad", () => ({ value: new Date() }), {
    owner: "example.provider",
    schema: { fields: {}, allowUnknown: true },
  });
  await assert.rejects(
    registry.invoke("example.provider:bad", {}),
    (error) => error instanceof PublicHookError && error.code === "hookResultInvalid",
  );
});

test("public hooks enforce a published schema and accept hyphenated owners", async () => {
  const registry = new PublicHookRegistry();
  registry.register(
    "example.foo-bar_1:decorate",
    (payload) => ({ label: payload.label.toUpperCase() }),
    {
      owner: "example.foo-bar_1",
      schema: { fields: { label: { type: "string", required: true } } },
    },
  );
  await assert.rejects(
    registry.invoke("example.foo-bar_1:decorate", { label: 3 }),
    (error) => error instanceof PublicHookError && error.code === "hookPayloadInvalid",
  );
  const result = await registry.invoke("example.foo-bar_1:decorate", { label: "note" });
  assert.deepEqual(result.payload, { label: "NOTE" });
});

test("runtime hook registrations are removed when an Extension is disabled", async () => {
  const id = `test.public-hooks.${Date.now()}`;
  const runtime = new ExtensionRuntime({
    preferenceStore: new PreferenceStore(),
    hostVersion: "1.0.0",
    sandboxFactory: (input) => ({
      start: async () => {
        input.context.hooks.register(
          `${id}:decorate`,
          (payload) => ({ value: Number(payload.value) + 1 }),
          { fields: { value: { type: "number", required: true } } },
        );
      },
      dispose: () => {},
    }),
  });
  runtime.loadManifest(manifest(id), async () => ({ source: "export default {};" }));
  try {
    assert.equal((await runtime.enableAsync(id, true)).ok, true);
    assert.equal(publicHookRegistry.has(`${id}:decorate`), true);
    assert.equal(runtime.disable(id).ok, true);
    assert.equal(publicHookRegistry.has(`${id}:decorate`), false);
  } finally {
    runtime.unload(id);
  }
});
