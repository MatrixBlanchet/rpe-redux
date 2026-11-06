/** End-to-end room crypto, last-writer-wins application, and server log rules. */
import assert from "node:assert/strict";
import test from "node:test";
import { applyChartChanges } from "../core/collaboration/changes.ts";
import {
  createRoomKey,
  decryptBytes,
  decryptJson,
  encryptBytes,
  encryptJson,
  importRoomKey,
  normalizeRoomKey,
} from "../core/collaboration/e2e.ts";
import { CollaborationRooms } from "../core/collaboration/room.ts";

function chart() {
  return {
    META: { name: "room" },
    BPMList: [{ beat: [0, 0, 1], bpm: 120 }],
    judgeLineList: [
      {
        id: "line",
        notes: [{ id: "note", positionX: 1 }],
        eventLayers: [],
      },
    ],
  };
}

async function roomPayload() {
  const encoded = createRoomKey();
  const key = await importRoomKey(encoded);
  return { encoded, key, payload: await encryptJson(key, chart()) };
}

test("room keys are 32-byte base64url values and wrong keys fail closed", async () => {
  const { encoded, key, payload } = await roomPayload();
  assert.equal(normalizeRoomKey(` ${encoded} `), encoded);
  assert.equal(normalizeRoomKey("not-a-key"), null);
  assert.deepEqual(await decryptJson(key, payload), chart());
  const other = await importRoomKey(createRoomKey());
  await assert.rejects(() => decryptJson(other, payload));
});

test("asset encryption round-trips and rejects a different key", async () => {
  const key = await importRoomKey(createRoomKey());
  const other = await importRoomKey(createRoomKey());
  const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
  const encrypted = await encryptBytes(key, bytes);
  assert.notDeepEqual(encrypted, bytes);
  assert.deepEqual(await decryptBytes(key, encrypted), bytes);
  await assert.rejects(() => decryptBytes(other, encrypted));
});

test("force application converges without rejecting a moved base", () => {
  const before = chart();
  const changes = [
    { op: "set", path: "/META/name", before: "other", after: "winner" },
    {
      op: "add",
      path: "/judgeLineList/$line/notes/$note",
      after: { id: "note", positionX: 9 },
    },
    { op: "remove", path: "/judgeLineList/$line/notes/$missing", before: { id: "missing" } },
  ];
  assert.equal(applyChartChanges(before, changes).conflicts.length, 3);
  const forced = applyChartChanges(before, changes, { force: true });
  assert.equal(forced.conflicts.length, 0);
  assert.equal(forced.chart.META.name, "winner");
  assert.equal(forced.chart.judgeLineList[0].notes[0].positionX, 9);
});

test("encrypted rooms require leases, preserve opaque logs, and restore them", async () => {
  const rooms = new CollaborationRooms();
  const { key, payload } = await roomPayload();
  const created = rooms.create({ name: "Host", color: "#ffffff" }, payload, "", true);
  assert.equal(created.ok, true);
  const { room } = created.value;
  assert.equal(room.encrypted, true);
  assert.equal(rooms.encryptedTransactions(room).length, 0);
  const joined = rooms.requestJoin(room.id, room.invite, { name: "Editor", color: "#00ff00" });
  const approved = rooms.approve(room.hostId, joined.value.request.requestId, true, "editor");
  const editor = approved.value.member;
  const change = await encryptJson(key, [
    { op: "set", path: "/META/name", before: "room", after: "changed" },
  ]);
  const noLease = rooms.commit(editor.id, "no-lease", "edit", change);
  assert.equal(noLease.ok, false);
  assert.equal(noLease.code, "missing_lock");
  assert.equal(rooms.acquireLocks(editor.id, ["chart"]).ok, true);
  const committed = rooms.commit(editor.id, "tx", "edit", change, undefined, ["chart"]);
  assert.equal(committed.ok, true);
  assert.equal(committed.value.revision, 1);
  assert.deepEqual(room.chart, payload);
  assert.equal(rooms.encryptedTransactions(room).length, 1);
  const replay = await decryptJson(key, rooms.encryptedTransactions(room)[0].changes);
  assert.equal(replay[0].after, "changed");

  const state = rooms.exportState();
  assert.equal(state.rooms[0].encrypted, true);
  assert.equal(state.rooms[0].log.length, 1);
  const restored = new CollaborationRooms();
  restored.importState(state, new Map());
  const resumed = restored.resume(room.id, created.value.member.token);
  assert.equal(resumed.ok, true);
  assert.equal(restored.encryptedTransactions(resumed.value.room).length, 1);
});
