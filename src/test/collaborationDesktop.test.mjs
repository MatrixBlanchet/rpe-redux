/** Verifies the packaged Go sidecar and the TypeScript room client agree. */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { CollaborationClient } from "../core/collaboration/client.ts";

const root = fileURLToPath(new URL("../..", import.meta.url));
const binaryName = process.platform === "win32" ? "redux-service.exe" : "redux-service";
const binary = join(root, "src-tauri", "resources", binaryName);

function chart() {
  return {
    META: { name: "room" },
    BPMList: [{ beat: [0, 0, 1], bpm: 120 }],
    judgeLineList: [{ id: "line", notes: [], eventLayers: [] }],
  };
}

function startServer() {
  const scratch = join(root, ".scratch");
  mkdirSync(scratch, { recursive: true });
  const directory = mkdtempSync(join(scratch, "collab-desktop-"));
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
    { stdio: ["ignore", "pipe", "pipe"] },
  );
  return new Promise((resolve, reject) => {
    let buffer = "";
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      buffer += chunk;
      const line = buffer.split("\n")[0];
      if (!buffer.includes("\n")) {
        return;
      }
      try {
        resolve({ child, ready: JSON.parse(line), directory });
      } catch (error) {
        reject(error);
      }
    });
    child.once("error", reject);
    child.once("exit", (code) => reject(new Error(`sidecar exited early: ${code}`)));
  });
}

async function waitFor(predicate, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error("timed out waiting for collaboration state");
}

test(
  "packaged sidecar hosts a room for the TypeScript client",
  { skip: !existsSync(binary), timeout: 20_000 },
  async () => {
    const { child, ready, directory } = await startServer();
    const client = new CollaborationClient({
      socketFactory: (url) => new WebSocket(url),
      reconnect: false,
    });
    try {
      client.connect(`ws://127.0.0.1:${ready.collabPort}`);
      client.createRoom({ name: "Host", color: "#ffffff" }, chart(), "fingerprint");
      await waitFor(() => client.state.get().status === "connected");
      assert.ok(client.state.get().roomId);
      assert.equal(client.state.get().serverUrl, `ws://127.0.0.1:${ready.collabPort}`);

      assert.equal(await client.acquireLocks(["chart"]), true);
      client.sendTransaction({
        label: "rename",
        changes: [{ op: "set", path: "/META/name", before: "room", after: "next" }],
        affectedObjectIds: [],
        lockIds: ["chart"],
      });
      await waitFor(() => client.state.get().revision === 1);
      assert.equal(client.state.get().error, "");
    } finally {
      client.dispose();
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

test(
  "auto-approve rooms admit a guest as an editor without host action",
  { skip: !existsSync(binary), timeout: 20_000 },
  async () => {
    const { child, ready, directory } = await startServer();
    const host = new CollaborationClient({
      socketFactory: (url) => new WebSocket(url),
      reconnect: false,
    });
    const guest = new CollaborationClient({
      socketFactory: (url) => new WebSocket(url),
      reconnect: false,
    });
    try {
      const url = `ws://127.0.0.1:${ready.collabPort}`;
      host.connect(url);
      host.createRoom({ name: "Host", color: "#ffffff" }, chart(), "", {
        autoApproveEditor: true,
      });
      await waitFor(() => host.state.get().status === "connected");
      guest.connect(url);
      guest.join(host.state.get().roomId, host.state.get().invite, {
        name: "Guest",
        color: "#00ff00",
      });
      await waitFor(() => guest.state.get().status === "connected");
      assert.equal(guest.state.get().role, "editor");
      assert.equal(guest.state.get().serverUrl, url);
      assert.equal(host.state.get().serverUrl, url);
      assert.equal(host.state.get().pending.length, 0);
      assert.ok(guest.state.get().members.some((member) => member.role === "editor"));
    } finally {
      host.dispose();
      guest.dispose();
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

test(
  "encrypted sidecar room replays its opaque log to an approved guest",
  { skip: !existsSync(binary), timeout: 20_000 },
  async () => {
    const { child, ready, directory } = await startServer();
    const host = new CollaborationClient({
      socketFactory: (url) => new WebSocket(url),
      reconnect: false,
    });
    let guestChart = null;
    let guestAsset = null;
    const guest = new CollaborationClient({
      socketFactory: (url) => new WebSocket(url),
      reconnect: false,
      onSnapshot: (snapshot) => {
        guestChart = snapshot.chart;
      },
      onAssetReady: (_asset, bytes) => {
        guestAsset = bytes;
      },
    });
    try {
      const url = `ws://127.0.0.1:${ready.collabPort}`;
      host.connect(url);
      host.createRoom({ name: "Host", color: "#ffffff" }, chart(), "", { encrypted: true });
      await waitFor(() => host.state.get().status === "connected");
      assert.equal(host.state.get().encrypted, true);
      const key = host.state.get().roomKey;
      assert.ok(key);

      assert.equal(await host.acquireLocks(["chart"]), true);
      host.sendTransaction({
        label: "rename",
        changes: [{ op: "set", path: "/META/name", before: "room", after: "next" }],
        affectedObjectIds: [],
        lockIds: ["chart"],
      });
      await waitFor(() => host.state.get().revision === 1);
      const assetBytes = new Uint8Array([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4,
      ]);
      const assetHash = await host.uploadAsset("cover.png", assetBytes);
      assert.ok(assetHash);
      await waitFor(() => host.state.get().assets.some((asset) => asset.name === "cover.png"));

      guest.connect(url);
      guest.join(
        host.state.get().roomId,
        host.state.get().invite,
        { name: "Guest", color: "#00ff00" },
        key,
      );
      await waitFor(() => host.state.get().pending.length === 1);
      host.approve(host.state.get().pending[0].requestId, true, "editor");
      await waitFor(() => guest.state.get().status === "connected" && guestChart !== null);
      assert.equal(guest.state.get().encrypted, true);
      assert.equal(guestChart.META.name, "next");
      guest.requestAsset(assetHash, "cover.png");
      await waitFor(() => guestAsset !== null);
      assert.deepEqual(guestAsset, assetBytes);
    } finally {
      host.dispose();
      guest.dispose();
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
