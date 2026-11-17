/** The RPE drag prekey is read from the dispatcher's held-key set. */
import assert from "node:assert/strict";
import test from "node:test";
import { dragPrekeyHeld } from "../../../core/edit/timeline/dragPrekey.ts";
import {
  clearShortcutKeys,
  pressShortcutKey,
  releaseShortcutKey,
} from "../../../core/shortcuts/inputKeys.ts";

test("Z is held for the pointer gesture and released with the key", () => {
  clearShortcutKeys();
  pressShortcutKey("KeyZ", "Z");
  assert.equal(dragPrekeyHeld(), true);

  releaseShortcutKey("KeyZ");
  assert.equal(dragPrekeyHeld(), false);
  clearShortcutKeys();
});
