/**
 * The AI bridge activity log: timestamps, durations, request/response payloads,
 * status mapping, bounded retention, and clearing.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { McpActivityLog } from "../../../core/edit/mcp/activity.ts";

test("a started entry stays pending until it is settled", () => {
  let now = 1_000;
  let notifications = 0;
  const log = new McpActivityLog({ now: () => now, limit: 10 });
  log.subscribe(() => {
    notifications += 1;
  });

  const request = { method: "chart.read", params: { collection: "lines" } };
  const handle = log.begin(request);
  const [pending] = log.get();

  assert.equal(log.get().length, 1);
  assert.equal(pending.method, "chart.read");
  assert.equal(pending.at, 1_000);
  assert.equal(pending.status, "pending");
  assert.equal(pending.request, request);
  assert.equal(pending.response, undefined);
  assert.equal(notifications, 1);

  now = 1_042;
  const response = { ok: true, value: { status: "ok" }, revisions: {} };
  handle.finish(response);

  const [settled] = log.get();
  assert.equal(settled.status, "ok");
  assert.equal(settled.durationMs, 42);
  assert.equal(settled.response, response);
  assert.equal(notifications, 2);

  handle.finish({ ok: false, error: { code: "failed" } });
  assert.equal(log.get()[0].status, "ok");
  assert.equal(notifications, 2);
});

test("an answered envelope and a failed cell both report an error", () => {
  const log = new McpActivityLog({ now: () => 1 });
  log.begin({ method: "chart.apply" }).finish({ ok: false, error: { code: "conflict" } });
  log.begin({ method: "code.run" }).finish({ ok: true, value: { ok: false, logs: [] } });
  log.begin({ method: "cell.run" }).finish({ ok: true, value: { ok: true, logs: [] } });

  assert.deepEqual(
    log.get().map((entry) => entry.status),
    ["ok", "error", "error"],
  );
});

test("the log retains the newest entries up to its limit", () => {
  const log = new McpActivityLog({ now: () => 1, limit: 3 });
  const handles = [];
  for (let index = 0; index < 5; index += 1) {
    handles.push(log.begin({ method: `chart.read.${index}` }));
  }

  assert.deepEqual(
    log.get().map((entry) => entry.method),
    ["chart.read.4", "chart.read.3", "chart.read.2"],
  );

  handles[0].finish({ ok: true });
  assert.equal(log.get().length, 3);
  assert.equal(log.get()[0].status, "pending");
});

test("the byte budget drops older entries first", () => {
  const log = new McpActivityLog({ now: () => 1, limit: 10, budget: 64 });
  log.begin({ method: "chart.read", params: { text: "x".repeat(200) } });
  log.begin({ method: "chart.read", params: { text: "y".repeat(200) } });

  assert.equal(log.get().length, 1);
  assert.equal(log.get()[0].method, "chart.read");
  assert.equal(log.get()[0].request.params.text[0], "y");
});

test("clearing removes pending entries and they never revive", () => {
  const log = new McpActivityLog({ now: () => 1 });
  const handle = log.begin({ method: "cell.run" });
  log.clear();

  assert.equal(log.get().length, 0);
  handle.finish({ ok: true });
  assert.equal(log.get().length, 0);
});

test("a malformed frame is still visible with an unknown method", () => {
  const log = new McpActivityLog({ now: () => 1 });
  log.begin(null);

  assert.equal(log.get()[0].method, "(unknown)");
});
