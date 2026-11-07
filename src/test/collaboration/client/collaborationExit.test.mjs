/** Collaboration exit checks include preparation, connection and active rooms. */
import { test } from "node:test";
import { strict as assert } from "node:assert";
import {
  EMPTY_COLLABORATION_STATE,
  roomNeedsExitConfirmation,
} from "../../../core/collaboration/ui.ts";

test("exiting asks about preparing and active collaboration sessions", () => {
  assert.equal(roomNeedsExitConfirmation(EMPTY_COLLABORATION_STATE, false), false);
  assert.equal(roomNeedsExitConfirmation(EMPTY_COLLABORATION_STATE, true), true);
  for (const status of ["connecting", "waiting", "connected", "reconnecting", "offline"]) {
    assert.equal(roomNeedsExitConfirmation({ ...EMPTY_COLLABORATION_STATE, status }, false), true);
  }
  assert.equal(
    roomNeedsExitConfirmation({ ...EMPTY_COLLABORATION_STATE, status: "error" }, false),
    false,
  );
  assert.equal(
    roomNeedsExitConfirmation(
      { ...EMPTY_COLLABORATION_STATE, status: "error", roomId: "room" },
      false,
    ),
    true,
  );
});
