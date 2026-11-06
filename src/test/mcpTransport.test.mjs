/** Loopback MCP JSON-RPC guards, tool discovery, and editor-bridge forwarding. */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const binary =
  process.env.REDUX_SERVER_BIN ??
  join(
    root,
    "src-tauri",
    "resources",
    process.platform === "win32" ? "redux-service.exe" : "redux-service",
  );

function startServer() {
  const scratch = join(root, ".scratch");
  mkdirSync(scratch, { recursive: true });
  const directory = mkdtempSync(join(scratch, "mcp-transport-"));
  const child = spawn(
    binary,
    [
      "--port",
      "0",
      "--db",
      join(directory, "redux.db"),
      "--collab-port",
      "0",
      "--ai-port",
      "0",
      "--collab-data",
      join(directory, "collaboration"),
    ],
    {
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  return new Promise((resolve, reject) => {
    let buffer = "";
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      buffer += chunk;
      if (!buffer.includes("\n")) {
        return;
      }
      try {
        resolve({ child, ready: JSON.parse(buffer.split("\n")[0]), directory });
      } catch (error) {
        reject(error);
      }
    });
    child.once("error", reject);
    child.once("exit", (code) => reject(new Error(`sidecar exited early: ${code}`)));
  });
}

async function rpc(port, body, extraHeaders = {}) {
  const response = await fetch(`http://127.0.0.1:${port}/api/mcp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

async function openBridge(url) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    socket.addEventListener("open", () => resolve(socket), { once: true });
    socket.addEventListener("error", () => reject(new Error("bridge rejected")), { once: true });
  });
}

test(
  "MCP transport rejects browser-style requests, lists tools, and forwards through the bridge",
  { skip: !existsSync(binary), timeout: 20_000 },
  async (t) => {
    const { child, ready, directory } = await startServer();
    try {
      const endpointProbe = await fetch(`http://127.0.0.1:${ready.port}/api/mcp/endpoint`);
      if (endpointProbe.status === 404) {
        t.skip("sidecar binary predates the authenticated bridge; rebuild it first");
        return;
      }
      const textPlain = await fetch(`http://127.0.0.1:${ready.port}/api/mcp`, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize" }),
      });
      assert.equal(textPlain.status, 415);

      const foreignOrigin = await rpc(
        ready.port,
        { jsonrpc: "2.0", id: 2, method: "initialize" },
        { Origin: "https://example.com" },
      );
      assert.equal(foreignOrigin.status, 403);

      const initialize = await rpc(ready.port, {
        jsonrpc: "2.0",
        id: 3,
        method: "initialize",
        params: { protocolVersion: "2024-11-05" },
      });
      assert.equal(initialize.status, 200);
      assert.equal(initialize.body.result.serverInfo.name, "rpe-redux");
      // The transport contract only requires a server version to be reported.
      // The fixture binary may have been built from an older checkout, so this
      // test must not compare it with the current workspace package version.
      assert.equal(typeof initialize.body.result.serverInfo.version, "string");
      assert.ok(initialize.body.result.serverInfo.version.trim());
      assert.equal(initialize.body.result.protocolVersion, "2024-11-05");

      const negotiated = await rpc(ready.port, {
        jsonrpc: "2.0",
        id: 4,
        method: "initialize",
        params: { protocolVersion: "2099-01-01" },
      });
      assert.equal(negotiated.body.result.protocolVersion, "2025-06-18");

      const tools = await rpc(ready.port, {
        jsonrpc: "2.0",
        id: 5,
        method: "tools/list",
        params: {},
      });
      const applyTool = tools.body.result.tools.find((tool) => tool.name === "redux_chart_apply");
      assert.ok(applyTool);
      assert.equal(applyTool.annotations.readOnlyHint, false);
      assert.equal(applyTool.annotations.destructiveHint, true);
      assert.ok(applyTool.title);
      // The write tool has to describe its own transaction grammar: an external
      // client should not need the repository to build a valid request.
      assert.deepEqual(applyTool.inputSchema.required, ["request", "expectedChartFingerprint"]);
      const grammar = applyTool.inputSchema.$defs;
      assert.ok(grammar?.chartTransaction, "apply schema documents the transaction");
      for (const group of ["metadata", "lines", "notes", "events"]) {
        assert.ok(grammar.chartTransaction.properties[group], `transaction documents ${group}`);
      }
      assert.deepEqual(grammar.note.required, ["type", "startTime", "endTime", "positionX"]);
      assert.equal(grammar.beat.minItems, 3);
      assert.equal(grammar.beat.items.type, "integer");
      assert.ok(grammar.eventInsert.properties.eventType.enum.includes("moveYEvents"));
      assert.match(applyTool.description, /expectedChartFingerprint/);
      assert.match(applyTool.description, /chartTransaction/);
      const readTool = tools.body.result.tools.find((tool) => tool.name === "redux_chart_read");
      assert.equal(readTool.inputSchema.properties.limit.maximum, 100);
      assert.deepEqual(readTool.inputSchema.properties.collection.enum, [
        "metadata",
        "lines",
        "notes",
        "events",
      ]);
      const stateTool = tools.body.result.tools.find(
        (tool) => tool.name === "redux_document_state",
      );
      assert.equal(stateTool.annotations.readOnlyHint, true);
      const codeRunTool = tools.body.result.tools.find((tool) => tool.name === "redux_code_run");
      assert.ok(codeRunTool);
      assert.equal(codeRunTool.annotations.readOnlyHint, false);
      assert.deepEqual(codeRunTool.inputSchema.required, ["source"]);
      assert.equal(codeRunTool.inputSchema.properties.timeoutMs.maximum, 20000);
      const codeGuideTool = tools.body.result.tools.find(
        (tool) => tool.name === "redux_code_guide",
      );
      assert.ok(codeGuideTool);
      assert.equal(codeGuideTool.annotations.readOnlyHint, true);

      const unavailable = await rpc(ready.port, {
        jsonrpc: "2.0",
        id: 6,
        method: "tools/call",
        params: { name: "redux_document_state", arguments: {} },
      });
      assert.equal(unavailable.body.result.isError, true);
      assert.match(unavailable.body.result.content[0].text, /no editor/i);

      const endpointResponse = await fetch(`http://127.0.0.1:${ready.port}/api/mcp/endpoint`);
      assert.equal(endpointResponse.status, 200);
      const endpointBody = await endpointResponse.json();
      assert.equal(endpointBody.bridge, "/api/mcp/bridge");
      const endpointFile = JSON.parse(readFileSync(endpointBody.path, "utf8"));
      assert.equal(typeof endpointFile.token, "string");

      await assert.rejects(
        openBridge(`ws://127.0.0.1:${ready.port}/api/mcp/bridge`),
        /bridge rejected/,
      );
      await assert.rejects(
        openBridge(`ws://127.0.0.1:${ready.port}/api/mcp/bridge?token=wrong`),
        /bridge rejected/,
      );
      const bridge = await openBridge(
        `ws://127.0.0.1:${ready.port}/api/mcp/bridge?token=${encodeURIComponent(endpointFile.token)}`,
      );
      const revisions = {
        chartFingerprint: "fp",
        diskSnapshot: null,
        generation: 1,
      };
      bridge.addEventListener("message", (event) => {
        const message = JSON.parse(event.data);
        if (message.type !== "request") {
          return;
        }
        let value = { lifecycle: "ready" };
        if (message.request.method === "document.state") {
          assert.equal(message.request.params, undefined);
        }
        if (message.request.method === "cell.guide") {
          value = { text: "# cell guide" };
        }
        if (message.request.method === "cell.run" || message.request.method === "code.run") {
          if (message.request.params.source === "return 1;") {
            assert.equal(message.request.params.profile, "read");
          }
          if (message.request.params.source !== "return 1;") {
            bridge.send(
              JSON.stringify({
                type: "response",
                id: message.id,
                response: {
                  ok: false,
                  error: {
                    code: message.request.params.source,
                    message: `Code cell ${message.request.params.source}`,
                    details: { durationMs: 7 },
                  },
                  revisions,
                },
              }),
            );
            return;
          }
          value = {
            ok: true,
            value: 1,
            logs: [],
            durationMs: 1,
            startRevisions: revisions,
            endRevisions: revisions,
            capabilities: [],
            truncated: false,
          };
        }
        if (message.request.method === "chart.read") {
          bridge.send(
            JSON.stringify({
              type: "response",
              id: message.id,
              response: {
                ok: false,
                error: {
                  code: "stale_read",
                  message: "Chart read cursor is stale",
                  details: { cursor: "expired", conflicts: ["chartFingerprint"] },
                },
                revisions,
              },
            }),
          );
          return;
        }
        bridge.send(
          JSON.stringify({
            type: "response",
            id: message.id,
            response: {
              ok: true,
              value,
              revisions,
            },
          }),
        );
      });

      const forwarded = await rpc(ready.port, {
        jsonrpc: "2.0",
        id: 7,
        method: "tools/call",
        params: { name: "redux_document_state", arguments: {} },
      });
      assert.equal(forwarded.body.result.isError, false);
      assert.equal(forwarded.body.result.structuredContent.lifecycle, "ready");

      const rejected = await rpc(ready.port, {
        jsonrpc: "2.0",
        id: 8,
        method: "tools/call",
        params: { name: "redux_chart_read", arguments: { collection: "lines" } },
      });
      assert.equal(rejected.body.result.isError, true);
      assert.equal(rejected.body.result.structuredContent.error.code, "stale_read");
      assert.deepEqual(rejected.body.result.structuredContent.error.details.conflicts, [
        "chartFingerprint",
      ]);
      assert.match(rejected.body.result.content[1].text, /stale_read/);

      const cellTimeout = await rpc(ready.port, {
        jsonrpc: "2.0",
        id: 9,
        method: "tools/call",
        params: { name: "redux_code_run", arguments: { source: "timeout" } },
      });
      assert.equal(cellTimeout.body.result.isError, true);
      assert.equal(cellTimeout.body.result.structuredContent.code, "timeout");
      assert.equal(cellTimeout.body.result.structuredContent.details.durationMs, 7);
      assert.equal(cellTimeout.body.result.structuredContent.revisions.chartFingerprint, "fp");

      const guide = await fetch(`http://127.0.0.1:${ready.port}/api/cell/guide`);
      assert.equal(guide.status, 200);
      assert.match(await guide.text(), /cell guide/);

      const cellRun = await fetch(`http://127.0.0.1:${ready.port}/api/cell/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "return 1;", profile: "read" }),
      });
      assert.equal(cellRun.status, 200);
      assert.equal((await cellRun.json()).value, 1);

      const cellFailure = async (code, status) => {
        const response = await fetch(`http://127.0.0.1:${ready.port}/api/cell/run`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ source: code }),
        });
        assert.equal(response.status, status, `${code} status`);
        const body = await response.json();
        assert.equal(body.error.code, code);
        assert.equal(body.error.details.durationMs, 7);
        assert.equal(body.revisions.chartFingerprint, "fp");
      };
      await cellFailure("runtime", 503);
      await cellFailure("busy", 409);
      await cellFailure("timeout", 504);
      await cellFailure("cancelled", 409);

      const cellForeignOrigin = await fetch(`http://127.0.0.1:${ready.port}/api/cell/run`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://example.com",
        },
        body: JSON.stringify({ source: "return 1;" }),
      });
      assert.equal(cellForeignOrigin.status, 403);
      bridge.close();
    } finally {
      child.kill();
      await new Promise((resolve) => {
        if (child.exitCode !== null) {
          resolve();
          return;
        }
        child.once("exit", resolve);
      });
      try {
        rmSync(directory, { recursive: true, force: true });
      } catch {
        // Windows may still hold the SQLite sidecar files for a moment.
      }
    }
  },
);
