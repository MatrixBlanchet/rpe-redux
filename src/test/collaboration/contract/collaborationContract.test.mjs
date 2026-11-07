/** Locks the Go and TypeScript room contract to one shared vector file. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { canonicalNumber, stableFingerprint } from "../../../core/collaboration/changes.ts";
import { sanitizeAssetName } from "../../../core/collaboration/assets.ts";
import { CollaborationRooms, normalizeMaxMembers } from "../../../core/collaboration/room.ts";

const fixture = JSON.parse(
  readFileSync(new URL("../../fixtures/collab-contract.json", import.meta.url), "utf8"),
);

/** Expand a literal or repeated-name descriptor from the fixture. */
function expandName(value) {
  if (value === null) {
    return null;
  }
  if (typeof value === "string") {
    return value;
  }
  return value.repeat.repeat(value.count) + (value.suffix ?? "");
}

/** Minimal persisted room state carrying the case's maxMembers field. */
function persistedState(override) {
  return {
    rooms: [
      {
        id: "ROOM",
        invite: "invite123",
        hostId: "host",
        host: { id: "host", token: "token", profile: { name: "Host", color: "#ffffff" } },
        chart: { META: { name: "contract" }, BPMList: [], judgeLineList: [] },
        fingerprint: "fingerprint",
        revision: 0,
        createdAt: 1,
        assets: [],
        undo: [],
        ...override,
      },
    ],
    assetHashes: [],
  };
}

test("importState normalizes maxMembers to an integer in 2..32", () => {
  for (const entry of fixture.roomStates) {
    const rooms = new CollaborationRooms();
    rooms.importState(persistedState(entry.state), new Map());
    const resumed = rooms.resume("ROOM", "token");
    assert.equal(resumed.ok, true, `${entry.label}: room did not resume`);
    assert.equal(
      resumed.value.room.maxMembers,
      entry.expected.maxMembers,
      `${entry.label}: maxMembers`,
    );
  }
});

test("the maxMembers normalizer rejects fractional and non-numeric values", () => {
  assert.equal(normalizeMaxMembers(2.5), 4);
  assert.equal(normalizeMaxMembers("8"), 4);
  assert.equal(normalizeMaxMembers(Number.NaN), 4);
  assert.equal(normalizeMaxMembers(2), 2);
  assert.equal(normalizeMaxMembers(32), 32);
});

test("asset names use Unicode code points for the 240-character limit", () => {
  for (const entry of fixture.assetNames) {
    const input = expandName(entry.input);
    const expected = expandName(entry.expected);
    assert.equal(sanitizeAssetName(input), expected, entry.label);
  }
});

test("fingerprint numbers use one canonical shortest-round-trip spelling", () => {
  for (const entry of fixture.fingerprintNumbers) {
    assert.equal(canonicalNumber(entry.value), entry.canonical, entry.label);
  }
  const nonFinite = {
    NaN: Number.NaN,
    Infinity: Number.POSITIVE_INFINITY,
    "-Infinity": Number.NEGATIVE_INFINITY,
  };
  for (const entry of fixture.fingerprintNonFinite) {
    assert.equal(canonicalNumber(nonFinite[entry.value]), entry.canonical, entry.label);
  }
});

test("fingerprint digests match the shared numeric vectors", () => {
  for (const entry of fixture.fingerprintDigests) {
    assert.equal(stableFingerprint(entry.value), entry.expected, entry.label);
  }
});
