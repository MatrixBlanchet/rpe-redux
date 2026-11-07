/**
 * MCP adapter behaviour: enabling the Settings toggle is the write consent, so
 * an accepted transaction reaches the document coordinator without a prompt.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { redux } from "../../../core/api/index.ts";
import { codeCellCapabilities } from "../../../core/codecell/profiles.ts";
import { createDocumentChangeCoordinator } from "../../../core/edit/document/changeCoordinator.ts";
import { createMcpAdapter } from "../../../core/edit/mcp/adapter.ts";
import { connectMcpGuide } from "../../../core/edit/mcp/guide.ts";
import { gateExtensionApi } from "../../../core/extensions/capabilityGate.ts";

function documentState() {
  return {
    lifecycle: "open",
    operation: "idle",
    source: "synced",
    dirty: false,
    name: "fallin' fallin'.json",
    title: "fallin' fallin'",
    path: "C:\\charts\\fallin' fallin'.json",
    format: "json",
    revisions: { chartFingerprint: "fp", diskSnapshot: null, generation: 1 },
  };
}

function transactionHost(onSubmit) {
  return {
    coordinator: {
      trackPending: () => ({ change: { id: "pending-1" }, release: () => {} }),
      submit: async (request) => {
        onSubmit?.();
        const decision = await request.run();
        return { status: "accepted", value: decision.value };
      },
    },
    apply: () => ({ status: "committed", beforeFingerprint: "fp", afterFingerprint: "fp2" }),
  };
}

test("document.state reports the active document name, title, path, and format", async () => {
  const adapter = createMcpAdapter({
    enabled: true,
    chart: () => null,
    state: documentState,
    validate: () => ({ status: "rejected", issues: [] }),
    transaction: transactionHost(),
  });
  const response = await adapter.handle({ method: "document.state" });
  assert.equal(response.ok, true);
  assert.equal(response.value.name, "fallin' fallin'.json");
  assert.equal(response.value.title, "fallin' fallin'");
  assert.equal(response.value.path, "C:\\charts\\fallin' fallin'.json");
  assert.equal(response.value.format, "json");
});

test("chart.read exposes metadata for a pre-write check", async () => {
  const adapter = createMcpAdapter({
    enabled: true,
    chart: () => ({
      read: (collection) => ({
        status: "ok",
        chartFingerprint: "fp",
        generation: 1,
        items:
          collection === "metadata"
            ? [{ name: "fallin' fallin'", song: "song.mp3", offset: 120 }]
            : [],
        nextCursor: null,
      }),
    }),
    state: documentState,
    validate: () => ({ status: "rejected", issues: [] }),
    transaction: transactionHost(),
  });
  const response = await adapter.handle({
    method: "chart.read",
    params: { collection: "metadata" },
  });
  assert.equal(response.ok, true);
  assert.deepEqual(response.value.items, [
    { name: "fallin' fallin'", song: "song.mp3", offset: 120 },
  ]);
});

test("chart.validate omits the unusable preview handle", async () => {
  const adapter = createMcpAdapter({
    enabled: true,
    chart: () => ({}),
    state: documentState,
    validate: () => ({
      status: "previewed",
      affectedObjectIds: ["line-1"],
      issues: [],
      previewId: "transaction-preview-1",
    }),
    transaction: transactionHost(),
  });
  const response = await adapter.handle({
    method: "chart.validate",
    params: { request: { metadata: { name: "MCP" } } },
  });
  assert.equal(response.ok, true);
  assert.equal("previewId" in response.value, false);
  assert.deepEqual(response.value.affectedObjectIds, ["line-1"]);
});

test("an enabled MCP adapter applies a valid chart transaction without a prompt", async () => {
  let submitted = 0;
  const adapter = createMcpAdapter({
    enabled: () => true,
    chart: () => null,
    state: documentState,
    validate: () => ({ status: "rejected", issues: [] }),
    transaction: transactionHost(() => submitted++),
  });
  const response = await adapter.handle({
    method: "chart.apply",
    params: { request: { metadata: { name: "MCP" } }, expectedChartFingerprint: "fp" },
  });
  assert.equal(response.ok, true);
  assert.equal(response.value.status, "committed");
  assert.equal(submitted, 1);
});

test("an AI policy rejection stops chart.validate and chart.apply", async () => {
  let submitted = 0;
  let validated = 0;
  const issue = {
    code: "ai.feature.restricted",
    path: "notes.insert[0].note.speed",
    message: "restricted",
  };
  const adapter = createMcpAdapter({
    enabled: () => true,
    chart: () => ({}),
    state: documentState,
    validate: () => {
      validated += 1;
      return { status: "previewed", affectedObjectIds: [], issues: [], previewId: null };
    },
    transaction: transactionHost(() => submitted++),
    aiPolicy: () => [issue],
  });
  const validatedResponse = await adapter.handle({
    method: "chart.validate",
    params: { request: { notes: { insert: [] } } },
  });
  const appliedResponse = await adapter.handle({
    method: "chart.apply",
    params: { request: { notes: { insert: [] } }, expectedChartFingerprint: "fp" },
  });
  assert.equal(validatedResponse.ok, true);
  assert.equal(validatedResponse.value.status, "rejected");
  assert.deepEqual(validatedResponse.value.issues, [issue]);
  assert.equal(appliedResponse.ok, false);
  assert.equal(appliedResponse.error.code, "rejected");
  assert.deepEqual(appliedResponse.error.details.issues, [issue]);
  assert.equal(validated, 0);
  assert.equal(submitted, 0);
});

test("code.guide returns the guide bound by the application entry", async () => {
  const dispose = connectMcpGuide("# test code-cell guide");
  try {
    const adapter = createMcpAdapter({
      enabled: true,
      chart: () => null,
      state: documentState,
      validate: () => ({ status: "rejected", issues: [] }),
      transaction: transactionHost(),
    });
    const response = await adapter.handle({ method: "code.guide" });
    assert.equal(response.ok, true);
    assert.equal(response.value.text, "# test code-cell guide");
  } finally {
    dispose();
  }
});

test("code.run defaults a missing profile to write and keeps the result envelope", async () => {
  let received = null;
  const adapter = createMcpAdapter({
    enabled: true,
    chart: () => null,
    state: documentState,
    validate: () => ({ status: "rejected", issues: [] }),
    transaction: transactionHost(),
    code: {
      run: async (request) => {
        received = request;
        return {
          ok: true,
          value: { summary: "done" },
          logs: [{ level: "log", text: "hello", atMs: 1 }],
          durationMs: 3,
          startRevisions: { chartFingerprint: "fp", diskSnapshot: null, generation: 1 },
          endRevisions: { chartFingerprint: "fp", diskSnapshot: null, generation: 1 },
          capabilities: ["document.read", "chart.read", "selection.read"],
          truncated: false,
        };
      },
    },
  });
  const response = await adapter.handle({
    method: "code.run",
    params: {
      source: "return { summary: 'done' };",
      args: { line: 2 },
      expected: { chartFingerprint: "fp" },
      timeoutMs: 5_000,
    },
  });
  assert.equal(response.ok, true);
  assert.equal(response.value.ok, true);
  assert.deepEqual(response.value.value, { summary: "done" });
  assert.equal(received.profile, "write");
  assert.deepEqual(received.args, { line: 2 });
  assert.equal(received.timeoutMs, 5_000);
});

test("code.run and cell.run forward an explicit read profile to the runtime", async () => {
  const received = [];
  const adapter = createMcpAdapter({
    enabled: true,
    chart: () => null,
    state: documentState,
    validate: () => ({ status: "rejected", issues: [] }),
    transaction: transactionHost(),
    code: {
      run: async (request) => {
        received.push(request);
        return {
          ok: true,
          value: 1,
          logs: [],
          durationMs: 1,
          startRevisions: { chartFingerprint: "fp", diskSnapshot: null, generation: 1 },
          endRevisions: { chartFingerprint: "fp", diskSnapshot: null, generation: 1 },
          capabilities: ["document.read", "chart.read", "selection.read"],
          truncated: false,
        };
      },
    },
  });
  for (const method of ["code.run", "cell.run"]) {
    const response = await adapter.handle({
      method,
      params: { source: "return 1;", profile: "read" },
    });
    assert.equal(response.ok, true, `${method} accepts the read profile`);
    assert.equal(received.at(-1).profile, "read", `${method} forwards the read profile`);
  }
  assert.equal(received.length, 2);
});

test("code.run and cell.run reject an invalid profile before the runtime", async () => {
  let called = 0;
  const adapter = createMcpAdapter({
    enabled: true,
    chart: () => null,
    state: documentState,
    validate: () => ({ status: "rejected", issues: [] }),
    transaction: transactionHost(),
    code: {
      run: async () => {
        called += 1;
        throw new Error("must not run");
      },
    },
  });
  for (const profile of ["admin", 1, null]) {
    for (const method of ["code.run", "cell.run"]) {
      const response = await adapter.handle({
        method,
        params: { source: "return 1;", profile },
      });
      assert.equal(response.ok, false, `${method} rejects profile ${String(profile)}`);
      assert.equal(response.error.code, "invalid_request");
    }
  }
  assert.equal(called, 0);
});

test("the read profile capability gate denies transaction writes", () => {
  const capabilities = codeCellCapabilities("read");
  assert.deepEqual(capabilities, ["document.read", "chart.read", "selection.read"]);
  const gated = gateExtensionApi(redux, new Set(capabilities));
  assert.throws(
    () => gated.transaction.apply({ metadata: { name: "read" } }),
    (error) => error?.code === "capabilityDenied" && error?.capability === "chart.write",
  );
});

test("code.run rejects a stale revision pin before the runtime", async () => {
  let called = 0;
  const adapter = createMcpAdapter({
    enabled: true,
    chart: () => null,
    state: documentState,
    validate: () => ({ status: "rejected", issues: [] }),
    transaction: transactionHost(),
    code: {
      run: async () => {
        called += 1;
        throw new Error("must not run");
      },
    },
  });
  const response = await adapter.handle({
    method: "code.run",
    params: { source: "return 1;", expected: { chartFingerprint: "other" } },
  });
  assert.equal(response.ok, false);
  assert.equal(response.error.code, "stale_read");
  assert.equal(called, 0);
});

test("code.run maps a runtime stale result to a stale_read tool error", async () => {
  const adapter = createMcpAdapter({
    enabled: true,
    chart: () => null,
    state: documentState,
    validate: () => ({ status: "rejected", issues: [] }),
    transaction: transactionHost(),
    code: {
      run: async () => ({
        ok: false,
        logs: [],
        error: { code: "stale_read", message: "Code cell base revision is stale" },
        durationMs: 1,
        startRevisions: { chartFingerprint: "fp", diskSnapshot: null, generation: 1 },
        endRevisions: { chartFingerprint: "fp2", diskSnapshot: null, generation: 2 },
        capabilities: ["document.read", "chart.read", "selection.read"],
        truncated: false,
      }),
    },
  });
  const response = await adapter.handle({
    method: "code.run",
    params: { source: "return 1;" },
  });
  assert.equal(response.ok, false);
  assert.equal(response.error.code, "stale_read");
});

test("code.run is disabled when the editor does not mount a code host", async () => {
  const adapter = createMcpAdapter({
    enabled: true,
    chart: () => null,
    state: documentState,
    validate: () => ({ status: "rejected", issues: [] }),
    transaction: transactionHost(),
  });
  const response = await adapter.handle({
    method: "code.run",
    params: { source: "return 1;" },
  });
  assert.equal(response.ok, false);
  assert.equal(response.error.code, "disabled");
});

test("code.run treats a source failure as a normal tool result", async () => {
  const adapter = createMcpAdapter({
    enabled: true,
    chart: () => null,
    state: documentState,
    validate: () => ({ status: "rejected", issues: [] }),
    transaction: transactionHost(),
    code: {
      run: async () => ({
        ok: false,
        logs: [{ level: "error", text: "bad", atMs: 1 }],
        error: {
          code: "syntax",
          name: "SyntaxError",
          message: "Unexpected token",
          line: 2,
          column: 4,
        },
        durationMs: 1,
        startRevisions: { chartFingerprint: "fp", diskSnapshot: null, generation: 1 },
        endRevisions: { chartFingerprint: "fp", diskSnapshot: null, generation: 1 },
        capabilities: ["document.read", "chart.read", "selection.read"],
        truncated: false,
      }),
    },
  });
  const response = await adapter.handle({
    method: "code.run",
    params: { source: "return (" },
  });
  assert.equal(response.ok, true);
  assert.equal(response.value.ok, false);
  assert.equal(response.value.error.code, "syntax");
});

test("code.run promotes runtime state failures with the cell result in details", async () => {
  const cases = [
    ["runtime", "runtime"],
    ["busy", "busy"],
    ["timeout", "timeout"],
    ["cancelled", "cancelled"],
  ];
  for (const [cellCode, mcpCode] of cases) {
    const adapter = createMcpAdapter({
      enabled: true,
      chart: () => null,
      state: documentState,
      validate: () => ({ status: "rejected", issues: [] }),
      transaction: transactionHost(),
      code: {
        run: async () => ({
          ok: false,
          logs: [{ level: "warn", text: cellCode, atMs: 1 }],
          error: { code: cellCode, message: `Code cell ${cellCode}` },
          durationMs: 7,
          startRevisions: { chartFingerprint: "fp", diskSnapshot: null, generation: 1 },
          endRevisions: { chartFingerprint: "fp2", diskSnapshot: null, generation: 2 },
          capabilities: ["document.read", "chart.read", "selection.read"],
          truncated: cellCode === "timeout",
        }),
      },
    });
    const response = await adapter.handle({
      method: "code.run",
      params: { source: "return 1;", profile: "read" },
    });
    assert.equal(response.ok, false, `${cellCode} is a transport failure`);
    assert.equal(response.error.code, mcpCode);
    assert.equal(response.error.details.error.code, cellCode);
    assert.equal(response.error.details.durationMs, 7);
    assert.equal(response.revisions.generation, 1);
  }
});

test("HTTP cell methods stay available when MCP is disabled", async () => {
  const adapter = createMcpAdapter({
    enabled: false,
    chart: () => null,
    state: documentState,
    validate: () => ({ status: "rejected", issues: [] }),
    transaction: transactionHost(),
    code: {
      run: async () => ({
        ok: true,
        value: 1,
        logs: [],
        durationMs: 1,
        startRevisions: { chartFingerprint: "fp", diskSnapshot: null, generation: 1 },
        endRevisions: { chartFingerprint: "fp", diskSnapshot: null, generation: 1 },
        capabilities: ["document.read", "chart.read", "selection.read"],
        truncated: false,
      }),
    },
  });
  const guide = await adapter.handle({ method: "cell.guide" });
  assert.equal(guide.ok, true);
  const run = await adapter.handle({ method: "cell.run", params: { source: "return 1;" } });
  assert.equal(run.ok, true);
  assert.equal(run.value.value, 1);
  const mcpRun = await adapter.handle({ method: "code.run", params: { source: "return 1;" } });
  assert.equal(mcpRun.ok, false);
  assert.equal(mcpRun.error.code, "disabled");
  const state = await adapter.handle({ method: "document.state" });
  assert.equal(state.ok, false);
  assert.equal(state.error.code, "disabled");
});

test("a disabled MCP adapter rejects every request before touching the document", async () => {
  let submitted = 0;
  const adapter = createMcpAdapter({
    enabled: () => false,
    chart: () => null,
    state: documentState,
    validate: () => ({ status: "rejected", issues: [] }),
    transaction: transactionHost(() => submitted++),
  });
  const response = await adapter.handle({ method: "document.state" });
  assert.equal(response.ok, false);
  assert.equal(response.error.code, "disabled");
  assert.equal(submitted, 0);
});

test("an MCP commit keeps the disk snapshot and synced source", async () => {
  const coordinator = createDocumentChangeCoordinator({
    initial: {
      chartFingerprint: "fp",
      savedChartFingerprint: "fp",
      diskSnapshot: "sha256:disk",
      generation: 4,
      lifecycle: "open",
      source: "synced",
    },
  });
  const state = () => {
    const current = coordinator.snapshot();
    return {
      lifecycle: current.lifecycle,
      operation: current.operation,
      source: current.source,
      dirty: current.dirty,
      revisions: {
        chartFingerprint: current.revisions.chartFingerprint,
        diskSnapshot: current.revisions.diskSnapshot,
        generation: current.revisions.generation,
      },
    };
  };
  const adapter = createMcpAdapter({
    enabled: true,
    chart: () => null,
    state,
    validate: () => ({ status: "rejected", issues: [] }),
    transaction: {
      coordinator,
      apply: () => ({ status: "committed", beforeFingerprint: "fp", afterFingerprint: "fp2" }),
    },
  });
  const response = await adapter.handle({
    method: "chart.apply",
    params: { request: { metadata: { name: "MCP" } }, expectedChartFingerprint: "fp" },
  });
  assert.equal(response.ok, true);
  const current = coordinator.snapshot();
  assert.equal(current.revisions.chartFingerprint, "fp2");
  assert.equal(current.revisions.diskSnapshot, "sha256:disk");
  assert.equal(current.source, "synced");
  assert.equal(current.dirty, true);
});

test("a read-only room blocks MCP chart writes before the transaction host", async () => {
  let submitted = 0;
  const adapter = createMcpAdapter({
    enabled: true,
    writeAllowed: () => false,
    chart: () => null,
    state: documentState,
    validate: () => ({ status: "rejected", issues: [] }),
    transaction: transactionHost(() => submitted++),
  });
  const response = await adapter.handle({
    method: "chart.apply",
    params: { request: {}, expectedChartFingerprint: "fp" },
  });
  assert.equal(response.ok, false);
  assert.equal(response.error.code, "rejected");
  assert.equal(submitted, 0);
});
