/**
 * Code-cell consent, revision, preview cleanup, and AI policy state machine.
 *
 * These cases exercise the runtime and restricted facade directly so a failed
 * revision read, revoked consent, or failed policy snapshot cannot quietly fall
 * through to a session write.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { redux } from "../core/api/index.ts";
import { CodeCellRuntime } from "../core/codecell/runtime.ts";
import { releaseCodeCellApi, restrictCodeCellApi } from "../core/codecell/restrictedApi.ts";
import { createChart } from "../core/global/chart/chart.ts";
import { EditorSession } from "../core/edit/session/session.ts";
import { connectTransactionApi } from "../core/edit/transaction/service.ts";

const revisions = Object.freeze({
  chartFingerprint: "fp",
  diskSnapshot: null,
  generation: 1,
});

function factoryFor(outcome, capture) {
  return (input) => {
    capture.input = input;
    return {
      start: async () => {},
      runCell: async () => outcome,
      dispose: () => {
        capture.disposed = true;
      },
    };
  };
}

function runtimeFor(factory, overrides = {}) {
  return new CodeCellRuntime({
    sandboxFactory: factory,
    api: () => redux,
    enabled: () => true,
    revisions: () => revisions,
    reportFailure: () => {},
    ...overrides,
  });
}

test("a timed-out cell cancels its open preview and keeps captured logs", async () => {
  const cancelled = [];
  const transaction = {
    availability: () => ({ status: "available" }),
    preview: () => ({
      ok: true,
      value: {
        status: "previewed",
        affectedObjectIds: [],
        issues: [],
        previewId: "preview-timeout",
      },
    }),
    apply: () => {
      throw new Error("apply must not run");
    },
    cancel: (previewId) => {
      cancelled.push(previewId);
      return { ok: true, value: true };
    },
    history: () => ({ ok: true, value: { canUndo: false, canRedo: false } }),
    undo: () => ({}),
    redo: () => ({}),
  };
  const api = { ...redux, transaction };
  const runtime = runtimeFor(
    (input) => ({
      start: async () => {},
      runCell: async () => {
        input.context.api.transaction.preview({ metadata: { name: "pending" } });
        return {
          ok: false,
          logs: [{ level: "log", text: "before the loop", atMs: 4 }],
          error: { name: "TimeoutError", message: "Code cell timed out" },
          durationMs: 1_000,
          truncated: true,
        };
      },
      dispose: () => {},
    }),
    { api: () => api },
  );
  const result = await runtime.run({ source: "while (true) {}" });

  assert.equal(result.error.code, "timeout");
  assert.deepEqual(cancelled, ["preview-timeout"]);
  assert.equal(result.logs[0].text, "before the loop");
});

test("cancelling a running cell retires the preview it left open", async () => {
  const session = new EditorSession(createChart());
  const disconnect = connectTransactionApi({ session: () => session });
  try {
    let previewId = null;
    let markStarted;
    const started = new Promise((resolve) => {
      markStarted = resolve;
    });
    let finish;
    const runtime = runtimeFor((input) => ({
      start: async () => {},
      runCell: () => {
        const preview = input.context.api.transaction.preview({
          label: "pending",
          metadata: { name: "pending" },
        });
        previewId = preview.value.previewId;
        markStarted();
        return new Promise((resolve) => {
          finish = resolve;
        });
      },
      dispose: () => {
        finish?.({
          ok: false,
          logs: [],
          error: { name: "AbortError", message: "Code cell was disposed" },
          durationMs: 1,
          truncated: false,
        });
      },
    }));
    const pending = runtime.run({ source: "return 1;" });
    await started;
    runtime.cancel();
    const result = await pending;

    assert.equal(result.error.code, "cancelled");
    assert.ok(previewId);
    const replay = redux.transaction.apply(previewId);
    assert.equal(replay.value.status, "rejected");
    assert.equal(replay.value.issues[0].code, "preview.notFound");
    assert.equal(session.history.undoStack.length, 0);
  } finally {
    disconnect();
  }
});

test("an unreadable start revision fails the cell before the sandbox starts", async () => {
  const capture = {};
  const runtime = runtimeFor(factoryFor(null, capture), {
    revisions: () => {
      throw new Error("disk offline");
    },
  });
  const result = await runtime.run({ source: "return 1;" });

  assert.equal(result.ok, false);
  assert.equal(result.error.code, "runtime");
  assert.match(result.error.message, /disk offline/);
  assert.equal(capture.input, undefined);
  assert.equal(runtime.isRunning(), false);
});

test("an unreadable end revision fails closed but keeps the captured logs", async () => {
  let reads = 0;
  const runtime = runtimeFor(
    factoryFor(
      {
        ok: true,
        value: { answer: 42 },
        logs: [{ level: "log", text: "before end read", atMs: 2 }],
        durationMs: 3,
        truncated: false,
      },
      {},
    ),
    {
      revisions: () => {
        reads += 1;
        if (reads === 1) {
          return revisions;
        }
        throw new Error("disk offline");
      },
    },
  );
  const result = await runtime.run({ source: "return 42;" });

  assert.equal(result.ok, false);
  assert.equal(result.error.code, "runtime");
  assert.match(result.error.message, /disk offline/);
  assert.deepEqual(result.startRevisions, revisions);
  assert.equal(result.logs[0].text, "before end read");
});

test("revoking execution consent during a run cancels the active cell", async () => {
  let enabled = true;
  let notify = () => {};
  let markStarted;
  const started = new Promise((resolve) => {
    markStarted = resolve;
  });
  let resolveRun;
  const runtime = runtimeFor(
    () => ({
      start: async () => {},
      runCell: () => {
        markStarted();
        return new Promise((resolve) => {
          resolveRun = resolve;
        });
      },
      dispose: () => {
        resolveRun?.({
          ok: false,
          logs: [{ level: "log", text: "before revoke", atMs: 2 }],
          error: { name: "AbortError", message: "Code cell was disposed" },
          durationMs: 3,
          truncated: false,
        });
      },
    }),
    {
      enabled: () => enabled,
      watchEnabled: (listener) => {
        notify = listener;
        return () => {};
      },
    },
  );
  const pending = runtime.run({ source: "return 1;" });
  await started;
  enabled = false;
  notify();
  const result = await pending;

  assert.equal(result.error.code, "cancelled");
  assert.equal(result.logs[0].text, "before revoke");
  assert.equal(runtime.isRunning(), false);
});

test("a write is rejected when consent is revoked before it reaches the session", async () => {
  const session = new EditorSession(createChart());
  const disconnect = connectTransactionApi({ session: () => session });
  try {
    let enabled = true;
    let applied;
    const runtime = runtimeFor(
      (input) => ({
        start: async () => {},
        runCell: async () => {
          enabled = false;
          applied = input.context.api.transaction.apply({
            label: "cell edit",
            metadata: { name: "cell edit" },
          });
          return { ok: true, value: applied, logs: [], durationMs: 1, truncated: false };
        },
        dispose: () => {},
      }),
      {
        enabled: () => enabled,
        watchEnabled: () => () => {},
      },
    );
    const result = await runtime.run({ source: "return 1;" });

    assert.equal(result.ok, true);
    assert.equal(result.value.value.status, "rejected");
    assert.equal(result.value.value.issues[0].code, "code.execution.disabled");
    assert.equal(session.history.undoStack.length, 0);
  } finally {
    disconnect();
  }
});

test("a failed policy snapshot rejects event writes instead of treating them as untargeted", () => {
  let applyCalls = 0;
  const api = {
    ...redux,
    chart: {
      ...redux.chart,
      snapshot: () => ({
        ok: false,
        error: { code: "runtime", message: "snapshot failed" },
      }),
    },
    transaction: {
      ...redux.transaction,
      apply: () => {
        applyCalls += 1;
        throw new Error("apply must not run without a policy chart");
      },
    },
  };
  const restricted = restrictCodeCellApi(api, {
    capabilities: ["chart.write"],
    baseRevisions: revisions,
    currentRevisions: () => revisions,
  });
  try {
    const result = restricted.transaction.apply({
      events: { update: [{ id: "event-1", patch: { start: 1 } }] },
    });

    assert.equal(result.ok, true);
    assert.equal(result.value.status, "rejected");
    assert.equal(result.value.issues[0].code, "ai.policy.unavailable");
    assert.equal(applyCalls, 0);
  } finally {
    releaseCodeCellApi(restricted);
  }
});

test("the policy snapshot is reused until the chart revision changes", () => {
  let snapshotCalls = 0;
  let applyCalls = 0;
  let current = { ...revisions };
  const committed = {
    ok: true,
    value: {
      status: "committed",
      beforeFingerprint: "fp",
      afterFingerprint: "fp",
      affectedObjectIds: [],
      issues: [],
      history: null,
      conflict: null,
    },
  };
  const api = {
    ...redux,
    chart: {
      ...redux.chart,
      state: () => ({
        ok: true,
        value: {
          chartFingerprint: current.chartFingerprint,
          generation: current.generation,
        },
      }),
      snapshot: () => {
        snapshotCalls += 1;
        return { ok: true, value: { judgeLineList: [] } };
      },
    },
    transaction: {
      ...redux.transaction,
      apply: () => {
        applyCalls += 1;
        return committed;
      },
    },
  };
  const restricted = restrictCodeCellApi(api, {
    capabilities: ["chart.write"],
    currentRevisions: () => current,
  });
  try {
    restricted.transaction.apply({ label: "one", metadata: { name: "one" } });
    restricted.transaction.apply({ label: "two", metadata: { name: "two" } });
    assert.equal(applyCalls, 2);
    assert.equal(snapshotCalls, 1);

    current = { ...current, chartFingerprint: "fp-2", generation: 2 };
    restricted.transaction.apply({ label: "three", metadata: { name: "three" } });
    assert.equal(applyCalls, 3);
    assert.equal(snapshotCalls, 2);
  } finally {
    releaseCodeCellApi(restricted);
  }
});
