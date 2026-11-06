/**
 * The drawer holds its revealed list column while a floating surface is open.
 * These tests cover the shared count the drawer and popover layers agree on.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  holdFloatingSurface,
  isFloatingSurfaceOpen,
  subscribeFloatingSurface,
} from "../design/patterns/floatingSurface.ts";

test("nested floating surfaces hold until the last opener releases", () => {
  let notifications = 0;
  const unsubscribe = subscribeFloatingSurface(() => {
    notifications += 1;
  });
  assert.equal(isFloatingSurfaceOpen(), false);

  const first = holdFloatingSurface();
  const second = holdFloatingSurface();
  assert.equal(isFloatingSurfaceOpen(), true);

  first();
  first();
  assert.equal(isFloatingSurfaceOpen(), true);

  second();
  assert.equal(isFloatingSurfaceOpen(), false);
  assert.equal(notifications, 4);
  unsubscribe();
});
