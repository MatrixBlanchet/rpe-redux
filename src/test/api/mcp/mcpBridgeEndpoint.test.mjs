/** Bridge handshake file parsing and authenticated WebSocket URL building. */
import assert from "node:assert/strict";
import test from "node:test";
import { mcpBridgeUrl, parseMcpEndpointFile } from "../../../core/edit/mcp/bridgeEndpoint.ts";

test("the bridge handshake file yields its token", () => {
  assert.equal(
    parseMcpEndpointFile(
      JSON.stringify({ version: 1, token: "session-token", bridge: "/api/mcp/bridge" }),
    ),
    "session-token",
  );
});

test("malformed or tokenless handshake files are rejected", () => {
  assert.equal(parseMcpEndpointFile("not json"), null);
  assert.equal(parseMcpEndpointFile("null"), null);
  assert.equal(parseMcpEndpointFile(JSON.stringify({ version: 1, token: "" })), null);
  assert.equal(parseMcpEndpointFile(JSON.stringify({ version: 1, token: 7 })), null);
});

test("the bridge URL carries the token and upgrades the scheme", () => {
  assert.equal(
    mcpBridgeUrl("http://127.0.0.1:47821", "a b&c"),
    "ws://127.0.0.1:47821/api/mcp/bridge?token=a+b%26c",
  );
  assert.equal(
    mcpBridgeUrl("https://localhost:47821", "session-token"),
    "wss://localhost:47821/api/mcp/bridge?token=session-token",
  );
});
