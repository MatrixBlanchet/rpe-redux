/** Verifies nested host disposers survive the sandbox result bridge. */
import assert from "node:assert/strict";
import test from "node:test";
import {
  cloneForSandbox,
  createBridgeBudget,
  encodeBridgeResult,
} from "../frontend/platform/sandboxBridge.ts";

test("encodeBridgeResult keeps a nested category disposer", () => {
  const registration = { id: "probe", dispose: () => {} };
  const encoded = encodeBridgeResult(
    registration,
    {
      function: (candidate) =>
        candidate === registration.dispose ? { __disposer: "disposer:category" } : undefined,
    },
    createBridgeBudget(),
  );
  assert.deepEqual(encoded, {
    id: "probe",
    dispose: { __disposer: "disposer:category" },
  });
});

test("cloneForSandbox applies the disposer hook at any depth", () => {
  const nested = { register: () => {}, value: 1 };
  const cloned = cloneForSandbox(
    { registration: nested },
    {
      function: (candidate) =>
        candidate === nested.register ? { __disposer: "disposer:nested" } : undefined,
    },
    createBridgeBudget(),
  );
  assert.deepEqual(cloned, {
    registration: {
      register: { __disposer: "disposer:nested" },
      value: 1,
    },
  });
});
