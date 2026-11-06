/** Verifies the public provider snapshot and epoch contract. */
import assert from "node:assert/strict";
import test from "node:test";
import {
  provideExtensionData,
  readExtensionData,
  resetExtensionServices,
  subscribeExtensionData,
  updateExtensionData,
} from "../core/extensions/serviceRegistry.ts";

test("provider data advances its epoch and invalidates consumers", () => {
  resetExtensionServices();
  const changes = [];
  const dispose = provideExtensionData("provider.one", {
    id: "calc.result",
    version: "1",
    initial: { value: 1 },
  });
  const unlisten = subscribeExtensionData("consumer.one", "calc.result", (info) => {
    changes.push(info);
  });

  assert.deepEqual(readExtensionData("consumer.one", "calc.result"), {
    id: "calc.result",
    version: "1",
    provider: "provider.one",
    epoch: 0,
    available: true,
    value: { value: 1 },
  });
  updateExtensionData("provider.one", "calc.result", { value: 2 });
  assert.equal(changes.at(-1).epoch, 1);
  assert.deepEqual(changes.at(-1).value, { value: 2 });

  dispose();
  assert.equal(readExtensionData("consumer.one", "calc.result"), null);
  assert.equal(changes.at(-1), null);
  unlisten();
});

test("provider data rejects stale owners and oversized values", () => {
  resetExtensionServices();
  provideExtensionData("provider.one", { id: "calc.result", version: "1", initial: 1 });
  assert.throws(() => updateExtensionData("other.provider", "calc.result", 2), /does not own/i);
  assert.throws(
    () => updateExtensionData("provider.one", "calc.result", "x".repeat(300_000)),
    /serializable|size|exceeds/i,
  );
});

test("same-owner replacement advances the epoch before publishing the new value", () => {
  resetExtensionServices();
  const changes = [];
  provideExtensionData("provider.one", { id: "calc.result", version: "1", initial: 1 });
  subscribeExtensionData("consumer.one", "calc.result", (info) => changes.push(info));
  provideExtensionData("provider.one", { id: "calc.result", version: "2", initial: 2 });
  assert.equal(changes.at(-1).epoch, 1);
  assert.equal(changes.at(-1).version, "2");
});
