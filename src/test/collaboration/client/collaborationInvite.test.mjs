/** Clickable collaboration invitation links. */
import assert from "node:assert/strict";
import test from "node:test";
import {
  buildRoomInviteLink,
  createRoomPassword,
  normalizeRoomServerUrl,
  parseRoomInviteLink,
} from "../../../core/collaboration/invite.ts";

test("invite links round-trip the endpoint, room id, and password", () => {
  const invite = {
    serverUrl: "wss://example.trycloudflare.com",
    invite: "INVITE5678",
    roomId: "ROOM2345",
  };
  const link = buildRoomInviteLink(invite);
  assert.match(link, /^rperedux:\/\/join\?/);
  assert.match(link, /room=ROOM2345/);
  assert.deepEqual(parseRoomInviteLink(link), invite);
});

test("links from older builds still resolve by endpoint and password", () => {
  const link = "rperedux://join?server=wss%3A%2F%2Fexample.trycloudflare.com&invite=INVITE5678";
  assert.deepEqual(parseRoomInviteLink(link), {
    serverUrl: "wss://example.trycloudflare.com",
    invite: "INVITE5678",
  });
});

test("generated room passwords are typeable and distinct", () => {
  const first = createRoomPassword();
  const second = createRoomPassword();
  assert.equal(first.length, 8);
  assert.match(first, /^[A-HJ-NP-Z2-9]+$/);
  assert.notEqual(first, second);
});

test("manual addresses normalize to ws or wss", () => {
  assert.equal(normalizeRoomServerUrl("192.168.1.10:47831"), "ws://192.168.1.10:47831");
  assert.equal(normalizeRoomServerUrl("http://example.com/rooms"), "ws://example.com/rooms");
  assert.equal(normalizeRoomServerUrl("https://example.com"), "wss://example.com");
  assert.equal(normalizeRoomServerUrl("wss://example.com/rooms"), "wss://example.com/rooms");
  assert.equal(
    normalizeRoomServerUrl("https://example.com/rooms#fragment"),
    "wss://example.com/rooms",
  );
  assert.equal(normalizeRoomServerUrl("ftp://example.com"), "");
  assert.equal(normalizeRoomServerUrl(""), "");
});

test("invalid or incomplete invite links are rejected", () => {
  assert.equal(parseRoomInviteLink("https://example.com/join?room=x"), null);
  assert.equal(parseRoomInviteLink("rperedux://join?room=x&invite=y"), null);
  assert.equal(parseRoomInviteLink("rperedux://other?server=x&room=x&invite=y"), null);
});
