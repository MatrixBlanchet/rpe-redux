/** Application-data image settings delete only references made unreachable. */
import assert from "node:assert/strict";
import test from "node:test";
import { replacedApplicationDataReference } from "../../../frontend/screens/settings/applicationDataLifecycle.ts";

test("replacement returns the previous image reference", () => {
  assert.equal(
    replacedApplicationDataReference(" backgrounds/old.png ", "backgrounds/new.png"),
    "backgrounds/old.png",
  );
});

test("clearing returns the previous image reference", () => {
  assert.equal(replacedApplicationDataReference("backgrounds/old.png", ""), "backgrounds/old.png");
});

test("unchanged or non-string values do not schedule deletion", () => {
  assert.equal(
    replacedApplicationDataReference("backgrounds/old.png", " backgrounds/old.png "),
    null,
  );
  assert.equal(replacedApplicationDataReference(undefined, "backgrounds/new.png"), null);
});
