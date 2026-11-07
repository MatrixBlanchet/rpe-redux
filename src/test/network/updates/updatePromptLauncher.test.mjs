/** Verifies that an update prompt can wait for the modal host to bind. */
import assert from "node:assert/strict";
import test from "node:test";
import {
  bindUpdatePromptLauncher,
  requestUpdatePrompt,
} from "../../../frontend/screens/settings/updates/updatePromptLauncher.ts";

test("queued update prompt resolves after the modal launcher binds", async () => {
  const requested = requestUpdatePrompt("2.0.0");
  const versions = [];
  const dispose = bindUpdatePromptLauncher(async (version) => {
    versions.push(version);
    return true;
  });

  assert.equal(await requested, true);
  assert.deepEqual(versions, ["2.0.0"]);
  dispose();
});
