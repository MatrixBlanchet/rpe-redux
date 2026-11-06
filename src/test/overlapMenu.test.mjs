/** The left-click overlap chooser never inherits right-click command rows. */
import assert from "node:assert/strict";
import test from "node:test";
import { overlapMenuContextSurface } from "../frontend/overlays/overlap/overlapMenuModel.ts";

test("overlap chooser does not expose a context-menu surface", () => {
  assert.equal(overlapMenuContextSurface(), undefined);
});
