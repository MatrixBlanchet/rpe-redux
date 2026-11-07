/** Verifies the public Extension service registry seam and its lifecycle rules. */
import assert from "node:assert/strict";
import test from "node:test";
import {
  callExtensionService,
  provideExtensionService,
  resetExtensionServices,
  resolveExtensionService,
  subscribeExtensionService,
  removeExtensionServices,
  ExtensionServiceError,
} from "../../../core/extensions/serviceRegistry.ts";

test.afterEach(() => {
  resetExtensionServices();
});

test("a consumer resolves and calls a versioned provider", async () => {
  const dispose = provideExtensionService("provider.alpha", {
    id: "charts.summary",
    version: "1.0.0",
    methods: {
      summarize: (value) => ({ value, source: "provider.alpha" }),
    },
  });

  assert.deepEqual(resolveExtensionService("consumer.beta", "charts.summary", "1.0.0"), {
    id: "charts.summary",
    version: "1.0.0",
    provider: "provider.alpha",
    available: true,
  });
  assert.deepEqual(
    await callExtensionService("consumer.beta", "charts.summary", "summarize", [7]),
    { value: 7, source: "provider.alpha" },
  );
  dispose();
});

test("provider replacement is owner-scoped and unavailable calls fail stably", async () => {
  const dispose = provideExtensionService("provider.alpha", {
    id: "charts.summary",
    version: "1.0.0",
    methods: { summarize: () => "first" },
  });
  assert.throws(
    () =>
      provideExtensionService("provider.other", {
        id: "charts.summary",
        version: "1.0.0",
        methods: { summarize: () => "second" },
      }),
    (error) => error instanceof ExtensionServiceError && error.code === "serviceAlreadyProvided",
  );
  dispose();
  await assert.rejects(
    () => callExtensionService("consumer.beta", "charts.summary", "summarize"),
    (error) => error instanceof ExtensionServiceError && error.code === "serviceUnavailable",
  );
});

test("service listeners observe availability and owner removal", () => {
  const states = [];
  const stop = subscribeExtensionService("consumer.beta", "charts.summary", (info) => {
    states.push(info?.provider ?? null);
  });
  const dispose = provideExtensionService("provider.alpha", {
    id: "charts.summary",
    version: "1.0.0",
    methods: { summarize: () => "ok" },
  });
  assert.deepEqual(states, [null, "provider.alpha"]);
  assert.equal(removeExtensionServices("provider.alpha"), 1);
  assert.deepEqual(states, [null, "provider.alpha", null]);
  dispose();
  stop();
});
