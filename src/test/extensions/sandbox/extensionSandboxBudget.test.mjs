/**
 * Verifies sandbox bridge budgets reject oversized values with structured
 * errors and that `ui.update` traffic is rate limited without losing the tail.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { values as valuesApi } from "../../../core/api/values.ts";
import {
  BRIDGE_LIMITS,
  BridgeBudgetError,
  cloneForSandbox,
  createBridgeBudget,
  createSandboxValueHandleTable,
  decodeBridgeArgs,
  encodeBridgeResult,
} from "../../../frontend/platform/sandboxBridge.ts";
import {
  SandboxUiUpdateBudget,
  UI_UPDATE_BURST,
  UI_UPDATE_STEADY_HZ,
} from "../../../frontend/platform/sandboxUiBudget.ts";

/** A deterministic clock whose `advance` runs due timers in time order. */
function createFakeClock() {
  let now = 0;
  let nextId = 0;
  const timers = new Map();
  return {
    now: () => now,
    setTimeout(handler, delayMs) {
      const id = ++nextId;
      timers.set(id, { at: now + Math.max(0, delayMs), handler });
      return id;
    },
    clearTimeout(handle) {
      timers.delete(handle);
    },
    pendingTimers: () => timers.size,
    advance(ms) {
      const target = now + ms;
      for (;;) {
        let next = null;
        for (const [id, timer] of timers) {
          if (timer.at <= target && (next === null || timer.at < next.timer.at)) {
            next = { id, timer };
          }
        }
        if (next === null) {
          break;
        }
        timers.delete(next.id);
        now = Math.max(now, next.timer.at);
        next.timer.handler();
      }
      now = target;
    },
  };
}

/** The largest number of updates one surface may render in one second. */
const UI_UPDATE_WINDOW_BUDGET = UI_UPDATE_STEADY_HZ + UI_UPDATE_BURST;

/** Assert that one bridge operation fails on the expected budget kind. */
function assertBudget(fn, kind) {
  assert.throws(fn, (error) => {
    assert.ok(error instanceof BridgeBudgetError, "expected BridgeBudgetError");
    assert.equal(error.code, "bridge.limit");
    assert.equal(error.kind, kind);
    assert.deepEqual(error.details, { kind, limit: error.limit });
    return true;
  });
}

test("the default bridge limits are finite and shared", () => {
  for (const [name, value] of Object.entries(BRIDGE_LIMITS)) {
    assert.ok(Number.isFinite(value) && value > 0, `${name} is not a positive limit`);
  }
});

test("decodeBridgeArgs restores bytes and callbacks", () => {
  const decoded = decodeBridgeArgs(
    {
      bytes: { __bytes: [1, 2, 3] },
      list: [1, { __callback: 7 }],
    },
    {
      callback:
        (id) =>
        (...args) => ({ id, args }),
    },
  );
  assert.deepEqual(Array.from(decoded.bytes), [1, 2, 3]);
  assert.deepEqual(decoded.list[1]("payload"), { id: 7, args: ["payload"] });
});

test("decodeBridgeArgs applies one cumulative byte budget to sibling values", () => {
  const value = ["1234567890", "1234567890", "1234567890"];
  const budget = createBridgeBudget({ bytes: 70 });
  assertBudget(() => decodeBridgeArgs(value, {}, budget), "bytes");
});

test("decodeBridgeArgs rejects one oversized string", () => {
  assertBudget(
    () => decodeBridgeArgs("12345", {}, createBridgeBudget({ stringLength: 4 })),
    "string",
  );
});

test("decodeBridgeArgs rejects an oversized array", () => {
  assertBudget(
    () => decodeBridgeArgs([1, 2, 3], {}, createBridgeBudget({ arrayLength: 2 })),
    "array",
  );
});

test("decodeBridgeArgs rejects excessive nesting", () => {
  const value = { a: { b: { c: 1 } } };
  assertBudget(() => decodeBridgeArgs(value, {}, createBridgeBudget({ depth: 2 })), "depth");
});

test("decodeBridgeArgs rejects excessive node counts", () => {
  assertBudget(() => decodeBridgeArgs([1, 2], {}, createBridgeBudget({ nodes: 2 })), "nodes");
});

test("decodeBridgeArgs drops prototype keys", () => {
  const decoded = decodeBridgeArgs(JSON.parse('{"__proto__":{"polluted":true},"safe":1}'));
  assert.equal(decoded.safe, 1);
  assert.equal({}.polluted, undefined);
  assert.equal(Object.hasOwn(decoded, "__proto__"), false);
});

test("cloneForSandbox rejects a cyclic value at the depth budget", () => {
  const cyclic = { name: "cycle" };
  cyclic.self = cyclic;
  assertBudget(() => cloneForSandbox(cyclic, {}, createBridgeBudget({ depth: 4 })), "depth");
});

test("cloneForSandbox rejects an oversized result before it reaches the iframe", () => {
  assertBudget(
    () => cloneForSandbox({ text: "x".repeat(20) }, {}, createBridgeBudget({ bytes: 24 })),
    "bytes",
  );
});

test("encodeBridgeResult returns a structured budget error for an oversized result", () => {
  assertBudget(
    () => encodeBridgeResult({ text: "x".repeat(20) }, {}, createBridgeBudget({ bytes: 24 })),
    "bytes",
  );
});

test("encodeBridgeResult keeps value-handle and disposer markers", () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const handle = valuesApi.define({ id: `budget.handle.${suffix}`, initial: "initial" });
  let nextId = 1;
  const table = createSandboxValueHandleTable(() => nextId++);
  const encoded = encodeBridgeResult(handle, {
    valueHandle: (value) => (value === handle ? table.encode(handle) : undefined),
    function: () => ({ __disposer: "disposer:test" }),
  });
  assert.equal(encoded.id, handle.id);
  assert.equal(table.require(encoded.__valueHandle), handle);
  assert.deepEqual(
    encodeBridgeResult(() => {}, { function: () => ({ __disposer: "disposer:test" }) }),
    { __disposer: "disposer:test" },
  );
});

test("the value handle table dedupes, releases, and clears bridge ids", () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const handle = valuesApi.define({ id: `budget.table.${suffix}`, initial: 0 });
  let nextId = 1;
  const table = createSandboxValueHandleTable(() => nextId++);
  const first = table.encode(handle);
  const second = table.encode(handle);
  assert.equal(first.__valueHandle, second.__valueHandle);
  assert.equal(table.require(first.__valueHandle), handle);
  assert.equal(table.release(first.__valueHandle), true);
  assert.equal(table.release(first.__valueHandle), false);
  assert.throws(() => table.require(first.__valueHandle), /not available/u);
  table.encode(handle);
  table.clear();
  assert.throws(() => table.require(second.__valueHandle), /not available/u);
});

test("ui.update keeps a 30 Hz window budget and delivers the tail frame", () => {
  const clock = createFakeClock();
  const budget = new SandboxUiUpdateBudget("test.budget.tail", { clock });
  const rendered = [];
  for (let index = 0; index < 100; index += 1) {
    budget.submit("panel", { tree: index, replace: false }, (update) => {
      rendered.push(update.tree);
    });
    clock.advance(10);
  }
  clock.advance(1_000);

  assert.ok(
    rendered.length <= UI_UPDATE_WINDOW_BUDGET,
    `rendered ${rendered.length} updates in one second`,
  );
  assert.equal(rendered.at(-1), 99, "the last declared tree never reached the surface");
  assert.equal(budget.stats().delivered, rendered.length);
  assert.ok(budget.stats().dropped > 0, "over-budget updates were not counted");
  assert.equal(clock.pendingTimers(), 0, "a delivered tail left its timer behind");
});

test("ui.update lets a normal 30 Hz producer through without drops", () => {
  const clock = createFakeClock();
  const budget = new SandboxUiUpdateBudget("test.budget.steady", { clock });
  const rendered = [];
  for (let index = 0; index < 30; index += 1) {
    budget.submit("panel", { tree: index, replace: false }, (update) => {
      rendered.push(update.tree);
    });
    clock.advance(1_000 / UI_UPDATE_STEADY_HZ);
  }

  assert.equal(rendered.length, 30);
  assert.deepEqual(
    rendered,
    Array.from({ length: 30 }, (_, index) => index),
  );
  assert.equal(budget.stats().dropped, 0);
});

test("replace and ordinary ui.update budgets count independently", () => {
  const clock = createFakeClock();
  const budget = new SandboxUiUpdateBudget("test.budget.replace", { clock });
  const rendered = [];
  for (let index = 0; index < 3; index += 1) {
    budget.submit("panel", { tree: `normal-${index}`, replace: false }, (update) => {
      rendered.push(update.tree);
    });
  }
  for (let index = 0; index < 3; index += 1) {
    budget.submit("panel", { tree: `replace-${index}`, replace: true }, (update) => {
      rendered.push(update.tree);
    });
  }

  assert.equal(rendered.length, UI_UPDATE_BURST * 2);
  assert.equal(budget.stats().dropped, 2);
  clock.advance(1_000 / UI_UPDATE_STEADY_HZ + 1);
  assert.equal(rendered.length, 5, "the newer replace tree should win the shared tail");
  assert.equal(rendered.at(-1), "replace-2");
  assert.equal(clock.pendingTimers(), 0);
});

test("releasing a surface or sandbox clears buckets and pending timers", () => {
  const clock = createFakeClock();
  const budget = new SandboxUiUpdateBudget("test.budget.release", { clock });
  const rendered = [];
  for (const surfaceId of ["panel", "overlay"]) {
    for (let index = 0; index < 3; index += 1) {
      budget.submit(surfaceId, { tree: `${surfaceId}-${index}`, replace: false }, (update) => {
        rendered.push(update.tree);
      });
    }
  }
  assert.equal(budget.stats().surfaces, 2);
  assert.equal(clock.pendingTimers(), 2);

  assert.equal(budget.release("panel"), true);
  assert.equal(budget.release("panel"), false);
  assert.equal(budget.stats().surfaces, 1);
  assert.equal(clock.pendingTimers(), 1);

  budget.dispose();
  assert.equal(budget.stats().surfaces, 0);
  assert.equal(clock.pendingTimers(), 0);
  const renderedBefore = rendered.length;
  clock.advance(1_000);
  assert.equal(rendered.length, renderedBefore, "a released surface kept rendering");
});
